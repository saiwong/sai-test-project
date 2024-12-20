import fetch from 'fetch-jsonp';
import { stringify } from 'querystring';
import Nav from 'react-bootstrap/Nav';
import Table from 'react-bootstrap/Table';
import React, { useState, useEffect} from 'react';
import { Converter } from 'opencc-js';

const converterSimp2Trad = Converter({ from: 'cn', to: 'hk' });

function Playlist({ songServerHost, selected }) {
  const [playlist, setPlaylist] = useState([]);

  useEffect(() => {
    if (selected) {
      getPlaylist();
  
      const refreshTimer = setInterval(() => {
        getPlaylist()
      }, 10000);

      return () => clearInterval(refreshTimer);
    }
  }, [selected]);

  async function getPlaylist() {
    // http://192.168.2.26:8084/demo/PlaylistServlet?jsonpCallback=jQuery11110772678249351443_1734639991156&onSelectPage=true&_=1734639991298
    // "[{"sINGER":"Michelle Branch","sONGBM":"00236161","sONGNAME":"Hopeless Romantic-mtv","xH":1073741832},{"sINGER":"Michelle Branch","sONGBM":"00235804","sONGNAME":"All you wanted-mtv","xH":1073741833},{"sINGER":"Michelle Branch","sONGBM":"00233517","sONGNAME":"TILL I GET OVER YOU-人物","xH":1073741834},{"sINGER":"MICHELLE BRANCH","sONGBM":"00047108","sONGNAME":"Loud Music","xH":1073741835}]"
    const songserver = `${songServerHost}/demo/PlaylistServlet`;
    const query = stringify({
      onSelectPage: 'true',
      _: Date.now(),
    });

    fetch(`${songserver}?${query}`, { jsonpCallback: 'jsonpCallback' })
      .then(async (res) => await res.json())
      .then(data => {
        if (data.songList) {
          setPlaylist(JSON.parse(data.songList)
            .map(({ sINGER: singer, sONGNAME: title, xH: id }) => ({ id, singer, title }))
          );
        } else if (data.hasChange == "false") {
          // somethign happened, we wait a bit and try again!
          setTimeout(() => getPlaylist(), 250);
        } else {
          setPlaylist([]);
        }
      })
      .catch(err => console.error('command error', err));
  }

  async function songAction(cmd, cmdValue, refresh = true) {
    const songserver = `${songServerHost}/demo/CommandServlet`;
    const query = {
      cmd,
      cmdValue,
      _: Date.now(),
    };

    fetch(`${songserver}?${stringify(query)}`, { jsonpCallback: 'jsonpCallback' })
      .then(async (res) => console.log(res))
      .then(() => refresh ? getPlaylist() : false)
      .catch(err => console.error('command error', err));
    }

  async function playSongNext(id, refresh = true) {
    // http://192.168.2.26:8084/demo/CommandServlet?jsonpCallback=jQuery11110772678249351443_1734639991156&cmd=Pro2&cmdValue=1073741834&_=1734639991311
    songAction('Pro2', id, refresh);
  }

  async function deleteSong(id) {
    // http://192.168.2.26:8084/demo/CommandServlet?jsonpCallback=jQuery11110772678249351443_1734639991156&cmd=Del1&cmdValue=1073741833&_=1734639991446
    songAction('Del1', id);
  }

  async function skipSong() {
    // http://192.168.2.26:8084/demo/CommandServlet?jsonpCallback=jQuery11110772678249351443_1734639991156&cmd=Skip&_=1734639991431
    songAction('Skip');
  }

  async function pauseSong() {
    // http://192.168.2.26:8084/demo/CommandServlet?jsonpCallback=jQuery11110772678249351443_1734639991156&cmd=Play&_=1734639991483
    songAction('Play');
  }

  async function restartSong() {
    // http://192.168.2.26:8084/demo/CommandServlet?jsonpCallback=jQuery11110772678249351443_1734639991156&cmd=Reset&_=1734639991438
    songAction('Reset');
  }

  async function muteSinger() {
    // http://192.168.2.26:8084/demo/CommandServlet?jsonpCallback=jQuery11110772678249351443_1734639991156&cmd=MuOr&_=1734639991459
    songAction('MuOr');
  }

  async function muteSong() {
    // http://192.168.2.26:8084/demo/CommandServlet?jsonpCallback=jQuery11110772678249351443_1734639991156&cmd=Mute&_=1734639991477
    songAction('Mute');
  }

  // shuffle playlist
  // algorithm:
  //   - group by singer
  //   - pick songs from each singer that is equal to their % of songs in the list
  //   - iterate uniformly random on each singer until all the songs has been picked
  async function shufflePlaylist() {
    const shuffleArray = (array) => { 
      for (let i = array.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [array[i], array[j]] = [array[j], array[i]]; 
      } 
      return array; 
    }; 

    const songsBySinger = Object.values(playlist.reduce((o, item) => {
        o[item.singer.toLowerCase()] = (o[item.singer.toLowerCase()] || []).concat(item);
        return o;
    }, {}));

    const shuffledList = [];
    const singerIndex = [...Array(songsBySinger.length).keys()].map(i => i);

    while (shuffledList.length < playlist.length) {
        shuffleArray(singerIndex).forEach(index => {
            const items = songsBySinger[index];
            let pickCount = Math.ceil(songsBySinger.length * items.length / playlist.length);
            while (pickCount > 0) {
                pickCount--;
                const randomIndex = Math.floor(items.length * Math.random());
                const item = items.splice(randomIndex, 1)[0];
                shuffledList.unshift(item);
            }
        });
    }

    // enqueue each song in the shuffled order but only refresh playlist 
    // when done
    shuffledList.forEach(({ id }) => playSongNext(id, false));
    getPlaylist();
  }


  return (
    <div className="Playlist">
      <Nav className="justify-content-center">
        <Nav.Item>
          <Nav.Link onClick={() => restartSong()}>🔄 Restart</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link onClick={() => skipSong()}>⏭️ Skip</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link onClick={() => pauseSong()}>⏯️ Pause/Play</Nav.Link>
        </Nav.Item>
      </Nav>
      <Nav className="justify-content-center">
        <Nav.Item>
          <Nav.Link onClick={() => muteSinger()}>🎤 Mute/Unmute Singer</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link onClick={() => muteSong()}>🔇 Mute Music</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link onClick={() => shufflePlaylist()}>🔀 Shuffle Songs</Nav.Link>
        </Nav.Item>
      </Nav>
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Song Title</th>
            <th>Singer</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {playlist.map(({ id, title, singer }) =>
            <tr>
              <td><span className="song link">{converterSimp2Trad(title)}</span></td>
              <td><span className="singer link">{converterSimp2Trad(singer)}</span></td>
              <td className="actions">
                <span className="action next" onClick={() => playSongNext(id)}>⬆️</span>
                <span className="action delete" onClick={() => deleteSong(id)}>🗑️</span>
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}

export default Playlist;
