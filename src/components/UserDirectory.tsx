"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';

type User = {
  id: string;
  displayName: string;
  photoURL?: string;
  handle?: string;
  email?: string;
};

type UserDirectoryProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
};

export function UserDirectory({ isOpen, onClose, onSelectUser }: UserDirectoryProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !firebaseReady || !db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const usersQuery = query(collection(db, 'users'));

    const unsubscribe = onSnapshot(
      usersQuery,
      async (snapshot) => {
        const usersData: User[] = [];
        
        for (const docSnap of snapshot.docs) {
          // Skip current user
          if (docSnap.id === user?.uid) continue;

          const data = docSnap.data();
          usersData.push({
            id: docSnap.id,
            displayName: data.displayName || data.email?.split('@')[0] || 'Unknown User',
            photoURL: data.photoURL,
            handle: data.handle,
            email: data.email,
          });
        }

        // Sort alphabetically by display name
        usersData.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(usersData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching users:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen, user]);

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const queryLower = searchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(queryLower) ||
      u.handle?.toLowerCase().includes(queryLower) ||
      u.email?.toLowerCase().includes(queryLower)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Directory Container */}
      <div className="relative w-full max-w-md bg-neutral-900 rounded-lg sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 border-b border-neutral-800 flex-shrink-0">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-white truncate">User Directory</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition flex-shrink-0 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-2 sm:p-3 md:p-4 border-b border-neutral-800 flex-shrink-0">
          <div className="relative">
            <svg className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue text-sm sm:text-base"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8 sm:py-12 px-4">
              <div className="text-neutral-400 text-sm sm:text-base">Loading users...</div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center py-8 sm:py-12 px-4">
              <div className="text-neutral-400 text-center text-sm sm:text-base">
                {searchQuery ? 'No users found' : 'No users available'}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {filteredUsers.map((userItem) => (
                <button
                  key={userItem.id}
                  onClick={() => {
                    onSelectUser(userItem.id);
                    setSearchQuery('');
                  }}
                  className="w-full p-2 sm:p-3 md:p-4 hover:bg-neutral-800 transition text-left touch-manipulation min-h-[60px] sm:min-h-[70px]"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-neutral-700 flex-shrink-0">
                      {userItem.photoURL ? (
                        <img
                          src={userItem.photoURL}
                          alt={userItem.displayName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg font-semibold bg-ccaBlue text-white">
                          {userItem.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-neutral-600 rounded-full border-2 border-neutral-900"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate text-sm sm:text-base">
                        {userItem.displayName}
                      </div>
                      <div className="text-xs sm:text-sm text-neutral-400 truncate">
                        {userItem.handle ? `@${userItem.handle}` : userItem.email || 'Offline'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

