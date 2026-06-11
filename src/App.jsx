import { Routes, Route, Link } from 'react-router-dom';
import HomePage from './components/HomePage.jsx';
import PokemonDetail from './components/PokemonDetail.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="app-title">
          <span className="pokeball" aria-hidden="true" />
          <h1>Complete Pokédex</h1>
        </Link>
        <span className="app-subtitle">All 1025 Pokémon · evolutions · most valuable cards</span>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pokemon/:id" element={<PokemonDetail />} />
          <Route path="*" element={<p className="status-msg">Page not found.</p>} />
        </Routes>
      </main>
      <footer className="app-footer">
        Pokémon data from PokéAPI · card data &amp; market prices from TCGdex (TCGPlayer/Cardmarket) ·
        fan-favorite ranks from the 2020 “Pokémon of the Year” poll. Unofficial fan project.
      </footer>
    </div>
  );
}
