export const markdownToAdf = jest.fn((markdown: string) => ({
  version: 1,
  type: 'doc',
  content: []
}));
