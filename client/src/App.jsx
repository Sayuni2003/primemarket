import { useEffect, useState } from "react";
import { getUsers } from "./api.js";
import UserPicker from "./components/UserPicker.jsx";
import Feed from "./components/Feed.jsx";

// localStorage key for the selected user, so the choice survives closing the browser
const USER_KEY = "primemarket.userId";

export default function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(() => localStorage.getItem(USER_KEY));

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await getUsers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load the users once, when the page opens
  useEffect(() => {
    loadUsers();
  }, []);

  const selectUser = (id) => {
    localStorage.setItem(USER_KEY, id);
    setUserId(id);
  };

  const switchUser = () => {
    localStorage.removeItem(USER_KEY);
    setUserId(null);
  };

  // A stored id that isn't in the users list (e.g. after a re-seed) finds nothing, so the picker shows
  const user = users.find((item) => item._id === userId);

  return (
    <>
      <header className="navbar">
        <div className="navbar-inner">
          <h1>PrimeMarket</h1>
          {user && (
            <div className="signed-in">
              <span className="user-name" title={`Signed in as ${user.name}`}>
                <PersonIcon />
                {user.name}
              </span>
              <button className="success" onClick={switchUser}>
                Switch user
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app">
        {loading && <p className="status">Loading users…</p>}
        {error && (
          <p className="error">
            {error} <button onClick={loadUsers}>Try again</button>
          </p>
        )}
        {/* key={user._id} gives every user a fresh Feed: new fetch, no leftover "Saved ✓" or open modal */}
        {!loading && !error && (user ? <Feed key={user._id} userId={user._id} /> : <UserPicker users={users} onSelect={selectUser} />)}
      </main>
    </>
  );
}

// A person outline (head and shoulders), drawn inline so no icon library is needed
function PersonIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}
