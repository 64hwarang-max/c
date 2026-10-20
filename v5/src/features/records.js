/* features/records — 기록 탭에서 쓰는 것은 책(K.books)뿐이다. 노트·거래·만남은 오늘 화면에서만 쓰고 여기서는 읽기만 한다. */
import { K } from '../core/schema.js';
import { clone } from '../core/util.js';
import { addBook, patchBook, removeBook, booksOf } from '../domain/records.js';

export function createRecordActions({ store }) {
  const edit = fn => store.lock(async () => {
    const before = await store.get(K.books), after = fn(clone(before == null ? {} : before));
    await store.put(K.books, after);
    return { undo: () => (before == null ? store.del(K.books) : store.put(K.books, before)) };
  });
  return {
    loadBooks: async () => (await store.get(K.books)) || {},
    async addBook(f) { let book; const r = await edit(d => { const x = addBook(d, f); book = x.book; return x.doc; }); return { ...r, book }; },
    editBook: (id, patch) => edit(d => patchBook(d, id, patch)),
    deleteBook: id => edit(d => removeBook(d, id)),
    count: doc => booksOf(doc).length,
  };
}
