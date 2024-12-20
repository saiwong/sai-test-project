import './App.css';
import Search from './Search';
import Playlist from './Playlist';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import React, { useState } from 'react';

// Get the server host from the query params
const songServerHost = new URLSearchParams(window.location.search).get('songServerHost');

function App() {
  const [selectedTab, setSelectedTab] = useState('search');


  return (
    <div className="App">
      <Tabs
        defaultActiveKey="search"
        onSelect={key => setSelectedTab(key)}>
        <Tab eventKey="search" title="Search">
          <Search
            songServerHost={songServerHost}
            selected={selectedTab == 'search'} />
        </Tab>
        <Tab eventKey="playlist" title="Playlist">
          <Playlist
            songServerHost={songServerHost}
            selected={selectedTab == 'playlist'} />
        </Tab>
      </Tabs>
    </div>
  );
}

export default App;
