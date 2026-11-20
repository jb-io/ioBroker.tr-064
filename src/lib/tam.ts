/** The message lists of the answering machines for `states.abMessages` */
import { dateKey } from './calllist';
import type { TamListItem, TamMessage, TamMessageListXml } from './types';

/** One answering machine which is shown in the web interface of the box */
export interface TamInfo {
    index: number;
    name: string;
}

/** The answering machines of `GetList` which are shown in the web interface */
export function visibleTams(items: TamListItem | TamListItem[] | undefined): TamInfo[] {
    const list = Array.isArray(items) ? items : items ? [items] : [];
    return list
        .filter(item => item.display === '1')
        .map(item => ({ index: ~~Number(item.index), name: typeof item.name === 'string' ? item.name : '' }));
}

/** `root.message` of the message list as an array, every message with the name of its answering machine */
export function getMessages(json: TamMessageListXml | undefined, tam: TamInfo): TamMessage[] {
    const messages = json?.root?.message;
    const list = Array.isArray(messages) ? messages : messages ? [messages] : [];
    return list.map(message => ({ ...message, tamName: tam.name }));
}

/** Sorts the messages of all answering machines, the newest first */
export function sortMessages(messages: TamMessage[]): TamMessage[] {
    return messages.sort(
        (a, b) =>
            dateKey(b.date).localeCompare(dateKey(a.date)) ||
            ~~Number(a.tam) - ~~Number(b.tam) ||
            ~~Number(b.index) - ~~Number(a.index),
    );
}
