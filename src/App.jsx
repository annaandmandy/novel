import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Square from './pages/Square';
import Create from './pages/Create';
import Reader from './pages/Reader';
import NovelDetail from './pages/NovelDetail';
import Auth from './pages/Auth';
import Profile from './pages/Profile';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="square" element={<Square />} />
          <Route path="create" element={<Create />} />
          <Route path="novel/:id" element={<NovelDetail />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        {/* Reader is outside the main layout (full screen) */}
        <Route path="/read/:id" element={<Reader />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
