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
    <div className="app">
      <header className="header">
        <h1>PrimeMarket</h1>
        {user && (
          <div className="signed-in">
            <span>
              Signed in as <strong>{user.name}</strong>
            </span>
            <button onClick={switchUser}>Switch user</button>
          </div>
        )}
      </header>

      <main>
        {loading && <p className="status">Loading users…</p>}
        {error && (
          <p className="error">
            {error} <button onClick={loadUsers}>Try again</button>
          </p>
        )}
        {/* key={user._id} gives every user a fresh Feed: new fetch, no leftover "Saved ✓" or open modal */}
        {!loading && !error && (user ? <Feed key={user._id} userId={user._id} /> : <UserPicker users={users} onSelect={selectUser} />)}
      </main>
    </div>
  );
}
