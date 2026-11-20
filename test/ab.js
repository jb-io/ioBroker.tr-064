'use strict';

// the unit tests run against the TypeScript sources
require('tsx/cjs');

const assert = require('node:assert');
const { isOn, parseXml } = require('../src/lib/utils');
const { getMessages, sortMessages, visibleTams } = require('../src/lib/tam');
const { TR064Client } = require('../src/lib/tr064');

/** Message list as the box delivers it behind the URL of `GetMessageList` */
const MESSAGE_LIST = `<?xml version="1.0" encoding="utf-8"?>
<Root>
<Message><Index>2</Index><Tam>0</Tam><Called>987654</Called><Date>19.11.26 08:05</Date><Duration>0:01</Duration>
<Inbook>1</Inbook><Name>Max Mustermann</Name><New>1</New><Number>0301234567</Number>
<Path>/download.lua?path=/data/tam/rec/rec.0.002</Path></Message>
<Message><Index>1</Index><Tam>0</Tam><Called>987654</Called><Date>18.11.26 17:42</Date><Duration>0:02</Duration>
<Inbook>0</Inbook><Name></Name><New>0</New><Number></Number>
<Path>/download.lua?path=/data/tam/rec/rec.0.001</Path></Message>
</Root>`;

/** Parses XML like the adapter does */
function parse(xml) {
    let result;
    parseXml(xml, (err, json) => {
        assert.ifError(err);
        result = json;
    });
    return result;
}

/** Calls setAB with a fake client and returns the arguments of SetEnable */
function setAB(val, abIndex) {
    let args;
    const client = { abIndex, setEnableAB: a => (args = a) };
    TR064Client.prototype.setAB.call(client, val);
    return args;
}

describe('answering machine', () => {
    it('reads "0", "false" and "off" as off', () => {
        for (const val of [false, 0, '', '0', 'false', 'FALSE', 'off', ' 0 ']) {
            assert.strictEqual(isOn(val), false, JSON.stringify(val));
        }
        for (const val of [true, 1, '1', 'true', 'on', '2']) {
            assert.strictEqual(isOn(val), true, JSON.stringify(val));
        }
    });

    it('switches off with "<index>,0"', () => {
        assert.deepStrictEqual(setAB('1,0', 0), { NewIndex: 1, NewEnable: 0 });
        assert.deepStrictEqual(setAB('2, false', 0), { NewIndex: 2, NewEnable: 0 });
        assert.deepStrictEqual(setAB('1,off', 0), { NewIndex: 1, NewEnable: 0 });
        assert.deepStrictEqual(setAB('1,1', 0), { NewIndex: 1, NewEnable: 1 });
        assert.deepStrictEqual(setAB('0,true', 2), { NewIndex: 0, NewEnable: 1 });
    });

    it('uses states.abIndex without an index', () => {
        assert.deepStrictEqual(setAB(true, 2), { NewIndex: 2, NewEnable: 1 });
        assert.deepStrictEqual(setAB(false, 2), { NewIndex: 2, NewEnable: 0 });
        assert.deepStrictEqual(setAB('false', undefined), { NewIndex: 0, NewEnable: 0 });
    });
});

describe('answering machine messages', () => {
    it('keeps the fields of the box and adds the name of the answering machine', () => {
        const messages = getMessages(parse(MESSAGE_LIST), { index: 0, name: 'Anrufbeantworter' });
        assert.deepStrictEqual(messages[0], {
            index: '2',
            tam: '0',
            called: '987654',
            date: '19.11.26 08:05',
            duration: '0:01',
            inbook: '1',
            name: 'Max Mustermann',
            new: '1',
            number: '0301234567',
            path: '/download.lua?path=/data/tam/rec/rec.0.002',
            tamName: 'Anrufbeantworter',
        });
        assert.strictEqual(messages[1].new, '0');
        assert.strictEqual(messages[1].number, '');
    });

    it('reads a list with one message and an empty list', () => {
        const one = parse('<Root><Message><Index>0</Index><Tam>1</Tam><New>1</New></Message></Root>');
        assert.strictEqual(getMessages(one, { index: 1, name: '' }).length, 1);
        assert.deepStrictEqual(getMessages(parse('<Root></Root>'), { index: 0, name: '' }), []);
        assert.deepStrictEqual(getMessages(undefined, { index: 0, name: '' }), []);
    });

    it('uses only the answering machines shown in the web interface', () => {
        const json = parse(
            '<List><Item><Index>0</Index><Display>1</Display><Enable>1</Enable><Name>Privat</Name></Item>' +
                '<Item><Index>1</Index><Display>0</Display><Enable>0</Enable><Name></Name></Item>' +
                '<Item><Index>2</Index><Display>1</Display><Enable>0</Enable><Name></Name></Item></List>',
        );
        assert.deepStrictEqual(visibleTams(json.list.item), [
            { index: 0, name: 'Privat' },
            { index: 2, name: '' },
        ]);
        assert.deepStrictEqual(visibleTams(undefined), []);
    });

    it('sorts the messages of all answering machines, the newest first', () => {
        const msg = (tam, index, date) => ({ tam: String(tam), index: String(index), date });
        const sorted = sortMessages([
            msg(0, 1, '18.11.26 17:42'),
            msg(1, 0, '01.12.26 09:00'),
            msg(0, 2, '01.12.26 09:00'),
            msg(0, 0, '31.12.25 23:59'),
        ]);
        assert.deepStrictEqual(sorted, [
            msg(0, 2, '01.12.26 09:00'),
            msg(1, 0, '01.12.26 09:00'),
            msg(0, 1, '18.11.26 17:42'),
            msg(0, 0, '31.12.25 23:59'),
        ]);
    });
});
