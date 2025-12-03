import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Square from './pages/Square';
import Create from './pages/Create';
import Reader from './pages/Reader';
import NovelDetail from './pages/NovelDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="square" element={<Square />} />
          <Route path="create" element={<Create />} />
          <Route path="novel/:id" element={<NovelDetail />} />
          <Route path="profile" element={<div className="p-6 text-center text-slate-500">個人資料 (即將推出)</div>} />
        </Route>
        {/* Reader is outside the main layout (full screen) */}
        <Route path="/read/:id" element={<Reader />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
