import './App.css';
import Search from './Search';
import Playlist from './Playlist';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import React, { useState } from 'react';

function App() {
  const [selectedTab, setSelectedTab] = useState('search');
  return (
    <div className="App">
      <Tabs
        defaultActiveKey="search"
        onSelect={key => setSelectedTab(key)}>
        <Tab eventKey="search" title="Search">
          <Search selected={selectedTab == 'search'} />
        </Tab>
        <Tab eventKey="playlist" title="Playlist">
          <Playlist selected={selectedTab == 'playlist'} />
        </Tab>
      </Tabs>
    </div>
  );
}

export default App;
