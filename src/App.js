import './App.css';
import fetch from 'fetch-jsonp';
import { stringify } from 'querystring';
import { titleCase } from "title-case";
import Form from 'react-bootstrap/Form';
import Accordion from 'react-bootstrap/Accordion';
import Pagination from 'react-bootstrap/Pagination';
import { Converter } from 'opencc-js';
import { searchTitle, searchSinger } from './songs';
import React, { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

const converter = Converter({ from: 'hk', to: 'cn' });

function App() {
  const [songs, setSongs] = useState([]);
  const [singerQuery, setSingerQuery] = useState('');
  const [songQuery, setSongQuery] = useState('');
  const [singers, setSingers] = useState([]);
  const [page, setPage] = useState(0);

  const pageSize = 25;
  const totalPages = Math.ceil(songs.length / pageSize);

  function searchSingerQuery(inputQuery) {
    if (!inputQuery) {
      setSingers([]);
      selectSinger('');
      return;
    };
    const singersResults = new Set(searchSinger(converter(inputQuery))
      .map(({ item: { singer }}) => titleCase(singer.toLowerCase())));

    setSingers([...singersResults]);
  }

  function searchSongQuery(inputQuery, singer) {
    let query;

    if (!singer) {
      query = { title: converter(inputQuery) };
    } else if (!inputQuery) {
      query = { singer: converter(singer) };
    } else {
      query = {
        $and: [
          { singer: converter(singer) },
          { title: converter(inputQuery) },
        ]
      };
    };

    setSongQuery(inputQuery);
    setSongs(searchTitle(query));
    setPage(0);
  }

  function selectSinger(singer) {
    setSingerQuery(singer);
    searchSongQuery(songQuery, singer);
  }

  async function queueSong(songId) {
    // http://192.168.2.26:8084/demo/CommandServlet?jsonpCallback=jQuery111107815842212372168_1727462477689&cmd=Add1&cmdValue=00016959&_=1727462477843
    const songserver = 'http://192.168.2.26:8084/demo/CommandServlet'
    const query = stringify({
      cmd: 'Add1',
      cmdValue: songId,
      _: Date.now(),
    });

    fetch(`${songserver}?${query}`, { jsonpCallback: 'jsonpCallback' })
      .then(async (res) => console.log('command success', await res.json()))
      .catch(err => console.error('command error', err));
  }

  const debouncedSingerQuery = useDebouncedCallback(searchSingerQuery, 1000);
  const debouncedSongQuery = useDebouncedCallback(title => searchSongQuery(title, singerQuery), 1000);

  function songPagination() {
    if (!totalPages) return;

    return (
      <Pagination className='justify-content-end'>
        <Pagination.First disabled={page <= 0} onClick={() => setPage(0)} />
        <Pagination.Prev disabled={page <= 0} onClick={() => setPage(page - 1)} />

        <Pagination.Ellipsis />

        <Pagination.Next disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)} />
        <Pagination.Last disabled={page + 1 >= totalPages} onClick={() => setPage(totalPages - 1)} />
      </Pagination>
    );
  }


  return (
    <div className="App">
      <Form>
        <Form.Group className="mb-3" controlId="formSinger">
          <Form.Label>Singer</Form.Label>
          <Form.Control 
            type="search"
            placeholder="Enter name of Singer"
            onChange={({ target }) => debouncedSingerQuery(target.value)}
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="formSong">
          <Form.Label>Song</Form.Label>
          <Form.Control
            type="search"
            placeholder="Enter name of Song"
            onChange={({ target }) => debouncedSongQuery(target.value)}
          />
        </Form.Group>
      </Form>    

      <Accordion alwaysOpen="true">
        <Accordion.Item>
          <Accordion.Header>Matching Singers</Accordion.Header>
          <Accordion.Body>
            {singers.map(singer =>
              <span><a href="/#" onClick={() => selectSinger(singer)}>{singer}</a>&nbsp;&nbsp;</span>
            )}
          </Accordion.Body>
        </Accordion.Item>
        <Accordion.Item>
          <Accordion.Header>Matching Songs {singerQuery ? `for ${singerQuery}` : ''}</Accordion.Header>
          <Accordion.Body>
            {songPagination()}

            {songs.slice(page * pageSize, page * pageSize + pageSize).map(({ item: { id, title, singer } }) =>
              <div class="row align-items-start">
                <div class="col"><a href="/#" onClick={() => queueSong(id)}>{title}</a></div>
                <div class="col"><a href="/#" onClick={() => selectSinger(singer)}>{singer}</a></div>
              </div>
            )}

            {songPagination()}
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}

export default App;
