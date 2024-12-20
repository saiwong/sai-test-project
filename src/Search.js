import fetch from 'fetch-jsonp';
import { stringify } from 'querystring';
import { titleCase } from "title-case";
import Form from 'react-bootstrap/Form';
import Accordion from 'react-bootstrap/Accordion';
import Pagination from 'react-bootstrap/Pagination';
import Table from 'react-bootstrap/Table';
import { Converter } from 'opencc-js';
import { searchTitle, searchSinger } from './songs';
import React, { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

const converterTrad2Simp = Converter({ from: 'hk', to: 'cn' });
const converterSimp2Trad = Converter({ from: 'cn', to: 'hk' });

function Search() {
  const [songs, setSongs] = useState([]);
  const [singerQuery, setSingerQuery] = useState('');
  const [songQuery, setSongQuery] = useState('');
  const [singers, setSingers] = useState([]);
  const [page, setPage] = useState(0);
  const [fetchUrl, setFetchUrl] = useState('');

  const pageSize = 25;
  const totalPages = Math.ceil(songs.length / pageSize);

  function searchSingerQuery(inputQuery) {
    if (!inputQuery) {
      setSingers([]);
      selectSinger('');
      return;
    };
    const singersResults = new Set(searchSinger(converterTrad2Simp(inputQuery))
      .map(({ item: { singer }}) => titleCase(singer.toLowerCase())));

    setSingers([...singersResults]);
  }

  function searchSongQuery(inputQuery, singer) {
    let query;

    if (!singer) {
      query = { title: converterTrad2Simp(inputQuery) };
    } else if (!inputQuery) {
      query = { singer: converterTrad2Simp(singer) };
    } else {
      query = {
        $and: [
          { singer: converterTrad2Simp(singer) },
          { title: converterTrad2Simp(inputQuery) },
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

  async function queueSong(songId, cmd = 'Add1') {
    // http://192.168.2.26:8084/demo/CommandServlet?jsonpCallback=jQuery111107815842212372168_1727462477689&cmd=Add1&cmdValue=00016959&_=1727462477843
    const songserver = 'https://kmachine.tolbin.net/demo/CommandServlet'
    const query = stringify({
      cmd: cmd,
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
    <div className="Search">
      <Form className="form">
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
              <span className="singer link" onClick={() => selectSinger(singer)}>{converterSimp2Trad(singer)}</span>
            )}
          </Accordion.Body>
        </Accordion.Item>
        <Accordion.Item>
          <Accordion.Header>Matching Songs {singerQuery ? `for ${singerQuery}` : ''}</Accordion.Header>
          <Accordion.Body>
            {songPagination()}

            {!totalPages ? '' : 
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Song Title</th>
                    <th>Singer</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>

                {songs.slice(page * pageSize, page * pageSize + pageSize).map(({ item: { id, title, singer } }) =>
                  <tr>
                    <td><span className="song link" onClick={() => queueSong(id)}>{converterSimp2Trad(title)}</span></td>
                    <td><span className="singer link" onClick={() => selectSinger(singer)}>{converterSimp2Trad(singer)}</span></td>
                    <td>
                      <span className="action next" onClick={() => queueSong(id, 'Pro1')}>⬆️</span>
                    </td>
                  </tr>
                )}
                </tbody>
              </Table>
            }
            {songPagination()}
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}

export default Search;
