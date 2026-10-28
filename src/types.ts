export type BookStatus = 'unread' | 'reading' | 'finished';

export interface Book {
  id: string;
  isbn?: string;
  title: string;
  author: string;
  genre: string;
  coverUrl?: string;
  color: string;
  status: BookStatus;
  addedAt: number;
  finishedAt?: number;
}

export type BookInput = Pick<Book, 'title' | 'author' | 'genre'> & {
  isbn?: string;
  coverUrl?: string;
};
