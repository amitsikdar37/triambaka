import { useState } from 'react';
import { validatePhoneNumber } from './utils/api';
import CarrierResult from './components/CarrierResult';
import './index.css';

function App() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!phoneNumber) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await validatePhoneNumber(phoneNumber);
      if (data.valid) {
        setResult(data);
      } else {
        setError('Invalid phone number format. Please include country code.');
      }
    } catch (err) {
      setError('Failed to fetch data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="glass-panel">
        <h1 className="title">Vidur<span className="highlight"></span></h1>
        <p className="subtitle">Secure communication network and location identification protocol.</p>

        <form className="search-form" onSubmit={handleSearch}>
          <div className="input-group">
            <span className="icon">📡</span>
            <input
              type="tel"
              placeholder="e.g. 14155552671 (with country code)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !phoneNumber}>
              {loading ? <div className="spinner"></div> : 'IDENTIFY'}
            </button>
          </div>
        </form>

        {error && <div className="error-message">{error}</div>}

        {result && <CarrierResult data={result} />}
      </div>
      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
    </div>
  );
}

export default App;
