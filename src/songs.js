import Fuse from 'fuse.js';
import songList from './songs.json';

const fuseTitle = new Fuse(songList, {
  // isCaseSensitive: false,
  // includeScore: false,
  // shouldSort: true,
  // includeMatches: false,
  // findAllMatches: false,
  // minMatchCharLength: 1,
  // location: 0,
  // threshold: 0.6,
  // distance: 100,
  // useExtendedSearch: false,
  // ignoreLocation: false,
  // ignoreFieldNorm: false,
  // fieldNormWeight: 1,
  keys: [
    "title",
    "singer"
  ]
});

const fuseSinger = new Fuse(songList, {
  // isCaseSensitive: false,
  // includeScore: false,
  // shouldSort: true,
  // includeMatches: false,
  // findAllMatches: false,
  // minMatchCharLength: 1,
  // location: 0,
  threshold: 0.2,
  // distance: 100,
  // useExtendedSearch: false,
  // ignoreLocation: false,
  // ignoreFieldNorm: false,
  // fieldNormWeight: 1,
  keys: [
    "singer",
  ]
});

export function searchSinger(singer) {
  return fuseSinger.search(singer);
}

export function searchTitle(title) {
  return fuseTitle.search(title);
}

export default searchTitle;