"use client";
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, addDoc, serverTimestamp, where, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, firebaseReady } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';

type Job = { 
  id: string; 
  title: string; 
  company: string; 
  location: string; 
  type: string; 
  applyUrl?: string;
  description?: string;
  posted?: any;
  posterId: string;
};

const jobTypes = ['All Jobs', 'Full Time', 'Part Time', 'Contract', 'Freelance', 'Internship'];

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All Jobs');
  const [showPostForm, setShowPostForm] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  
  // Form state
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('Full Time');
  const [applyUrl, setApplyUrl] = useState('');
  const [description, setDescription] = useState('');

  // Fetch all jobs
  useEffect(() => {
    if (!firebaseReady || !db) return;
    const q = query(collection(db, 'opportunities'), orderBy('posted', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const allJobs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Job[];
      setJobs(allJobs);
    });
    return () => unsub();
  }, []);

  // Fetch user's jobs
  useEffect(() => {
    if (!firebaseReady || !db || !user) {
      setMyJobs([]);
      return;
    }
    const q = query(
      collection(db, 'opportunities'),
      where('posterId', '==', user.uid),
      orderBy('posted', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const jobs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Job[];
        setMyJobs(jobs);
      },
      (error) => {
        console.error('Error fetching user jobs:', error);
        // Try without orderBy if index doesn't exist
        const fallbackQuery = query(
          collection(db, 'opportunities'),
          where('posterId', '==', user.uid)
        );
        onSnapshot(fallbackQuery, (snap) => {
          const jobs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Job[];
          const sortedJobs = jobs.sort((a, b) => {
            const aTime = a.posted?.toDate?.() || a.posted || 0;
            const bTime = b.posted?.toDate?.() || b.posted || 0;
            return bTime - aTime;
          });
          setMyJobs(sortedJobs);
        });
      }
    );
    return () => unsub();
  }, [user]);

  // Filter jobs
  useEffect(() => {
    let filtered = jobs;

    // Filter by search query
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      filtered = filtered.filter(job =>
        job.title.toLowerCase().includes(queryLower) ||
        job.company.toLowerCase().includes(queryLower) ||
        job.location.toLowerCase().includes(queryLower)
      );
    }

    // Filter by job type
    if (selectedType !== 'All Jobs') {
      filtered = filtered.filter(job => job.type === selectedType);
    }

    setFilteredJobs(filtered);
  }, [jobs, searchQuery, selectedType]);

  const handlePostJob = async () => {
    if (!user) {
      alert('Please sign in to post an opportunity.');
      return;
    }
    if (!title || !company || !applyUrl) {
      alert('Please fill in all required fields including the application URL.');
      return;
    }
    if (!firebaseReady || !db) {
      alert('Firebase is not configured.');
      return;
    }

    try {
      await addDoc(collection(db, 'opportunities'), {
        title,
        company,
        location: location || 'Remote',
        type,
        applyUrl,
        description: description || '',
        posted: serverTimestamp(),
        posterId: user.uid
      });
      // Reset form
      setTitle('');
      setCompany('');
      setLocation('');
      setType('Full Time');
      setApplyUrl('');
      setDescription('');
      setShowPostForm(false);
    } catch (error) {
      console.error('Error posting job:', error);
      alert('Failed to post job. Please try again.');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job listing?')) return;
    if (!firebaseReady || !db) return;
    try {
      await deleteDoc(doc(db, 'opportunities', jobId));
      setShowManageModal(false);
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Failed to delete job. Please try again.');
    }
  };

  const displayJobs = filteredJobs;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold">Find Your Next Creative Opportunity</h1>
        <p className="mt-2 text-neutral-400">Browse job listings and connect with talented creators in the community.</p>
      </div>

      {!firebaseReady && (
        <div className="mb-6 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-sm">
          Firebase is not configured. Add your client keys in `.env.local` (see docs/ENV-EXAMPLE.txt), then restart the dev server.
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
            placeholder="Search jobs..."
          />
        </div>
        
        <button
          onClick={() => {
            if (user) {
              setShowManageModal(true);
            } else {
              alert('Please sign in to view your listings.');
            }
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          My Listings
        </button>

        <button
          onClick={() => setShowPostForm(!showPostForm)}
          className="px-4 py-2 rounded-lg bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue transition-all font-medium whitespace-nowrap"
        >
          Post an Opportunity
        </button>
      </div>

      {/* Job Type Filter Bar */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
        {jobTypes.map((jobType) => (
          <button
            key={jobType}
            onClick={() => setSelectedType(jobType)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedType === jobType
                ? 'bg-white text-black border-2 border-ccaBlue'
                : 'bg-neutral-900 border-2 border-transparent text-neutral-300 hover:text-white'
            }`}
          >
            {jobType}
          </button>
        ))}
      </div>

      {/* Post Job Form */}
      {showPostForm && (
        <div className="mb-6 p-6 rounded-xl border border-neutral-800 bg-neutral-950">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Post an Opportunity</h2>
            <button
              onClick={() => setShowPostForm(false)}
              className="text-neutral-400 hover:text-white transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">
                  Job Title *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Travel Videographer Needed"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">
                  Your Name or Company Name *
                </label>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Horizon Films or John M."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">
                  Location or Remote *
                </label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. New York, NY or Remote"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">
                  Job Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                >
                  {jobTypes.slice(1).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">
                Application URL *
              </label>
              <input
                type="url"
                value={applyUrl}
                onChange={(e) => setApplyUrl(e.target.value)}
                placeholder="https://yourcompany.com/apply or https://apply.workable.com/j/..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
              />
              <p className="mt-1 text-xs text-neutral-500">Link to your application form or job posting</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">
                Job Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the job, responsibilities, and expectations..."
                rows={4}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePostJob}
                className="px-6 py-2 rounded-lg bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue font-medium transition-all"
              >
                Post Opportunity
              </button>
              <button
                onClick={() => setShowPostForm(false)}
                className="px-6 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Listings Modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Manage Your Job Listings</h2>
              <button
                onClick={() => setShowManageModal(false)}
                className="text-neutral-400 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-neutral-400 mb-6">View, edit, or remove your job listings.</p>
            {myJobs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-400 mb-4">You don't have any job listings yet.</p>
                <button
                  onClick={() => {
                    setShowManageModal(false);
                    setShowPostForm(true);
                  }}
                  className="px-6 py-2 rounded-lg bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue font-medium transition-all"
                >
                  Post Your First Job
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myJobs.map((job) => (
                  <div key={job.id} className="p-4 rounded-lg border border-neutral-800 bg-neutral-900">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{job.title}</h3>
                        <p className="text-sm text-neutral-400">{job.company} • {job.location}</p>
                        <p className="text-xs text-neutral-500 mt-1">{job.type}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowManageModal(false)}
                className="px-6 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="space-y-4">
        {displayJobs.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-neutral-800 bg-neutral-950">
            <p className="text-neutral-400 text-lg">No opportunities found.</p>
            {searchQuery && (
              <p className="text-neutral-500 text-sm mt-2">Try adjusting your search or filter criteria.</p>
            )}
          </div>
        ) : (
          displayJobs.map((job) => (
            <div key={job.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-700 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-xl mb-1">{job.title}</h3>
                  <p className="text-neutral-400">{job.company} • {job.location}</p>
                  {job.description && (
                    <p className="text-sm text-neutral-300 mt-2 line-clamp-2">{job.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-300">
                      {job.type}
                    </span>
                    {job.posted && (
                      <span className="text-xs text-neutral-500">
                        Posted {new Date(job.posted.toDate?.() || job.posted).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {job.applyUrl ? (
                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-2 rounded-lg bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue font-medium transition-all whitespace-nowrap"
                    >
                      Apply Now
                    </a>
                  ) : (
                    <button
                      disabled
                      className="px-6 py-2 rounded-lg bg-neutral-800 text-neutral-500 border border-neutral-700 font-medium cursor-not-allowed whitespace-nowrap"
                    >
                      Apply Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
