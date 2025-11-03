"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth, firebaseReady, storage } from '@/lib/firebaseClient';
import { ProfileImageUpload } from '@/components/ProfileImageUpload';
import Link from 'next/link';
import OrdersTab from './OrdersTab';
import OnboardingTab from './OnboardingTab';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

type UserProfile = {
  displayName?: string;
  handle?: string;
  title?: string;
  specialties?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  linkedin?: string;
  instagram?: string;
  youtube?: string;
  emailJobOpportunities?: boolean;
  emailMarketplaceUpdates?: boolean;
  profilePublic?: boolean;
  photoURL?: string;
};

type Listing = { 
  id: string; 
  title: string; 
  price: number; 
  condition: string; 
  createdAt?: any;
  images?: string[];
  shipping?: number;
  description?: string;
};

type Opportunity = { 
  id: string; 
  title: string; 
  company: string; 
  location: string; 
  type: string; 
  posted?: any; 
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'projects' | 'social' | 'email' | 'privacy' | 'orders' | 'onboarding'>('projects');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  
  // Project form state
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectContent, setProjectContent] = useState('');
  const [projectPreview, setProjectPreview] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [projectImage, setProjectImage] = useState<File | null>(null);
  const [projectImagePreview, setProjectImagePreview] = useState<string>('');
  const [projectSkills, setProjectSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [projectUploading, setProjectUploading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  
  const recommendedSkills = [
    'After Effects', 'Color Grading', 'Editor', 'Cinematography', 
    'Motion Graphics', 'Sound Design', 'Directing', 'Producer',
    'DaVinci Resolve', 'Premiere Pro', 'Final Cut Pro', 'Avid',
    'Photoshop', 'Illustrator'
  ];
  
  // Profile state
  const [profile, setProfile] = useState<UserProfile>({});
  const [loading, setLoading] = useState(true);
  
  // Form state for editing
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editSpecialties, setEditSpecialties] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  
  // Social profiles
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  
  // Email preferences
  const [emailJobOpportunities, setEmailJobOpportunities] = useState(false);
  const [emailMarketplaceUpdates, setEmailMarketplaceUpdates] = useState(false);
  
  // Privacy
  const [profilePublic, setProfilePublic] = useState(false);
  
  // Marketplace data
  const [listings, setListings] = useState<Listing[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  // Fetch user profile
  useEffect(() => {
    if (!firebaseReady || !db || !user) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfile(data as UserProfile);
          setEditDisplayName(data.displayName || user.displayName || '');
          setEditHandle(data.handle || '');
          setEditTitle(data.title || '');
          setEditSpecialties(data.specialties || '');
          setEditLocation(data.location || '');
          setEditBio(data.bio || '');
          setEditSkills(data.skills || []);
          setLinkedin(data.linkedin || '');
          setInstagram(data.instagram || '');
          setYoutube(data.youtube || '');
          setEmailJobOpportunities(data.emailJobOpportunities ?? false);
          setEmailMarketplaceUpdates(data.emailMarketplaceUpdates ?? false);
          setProfilePublic(data.profilePublic ?? true);
        } else {
          // Initialize with defaults
          const defaultProfile: UserProfile = {
            displayName: user.displayName || user.email?.split('@')[0] || 'Creator',
            handle: '',
            title: '',
            specialties: '',
            location: '',
            bio: '',
            skills: [],
            profilePublic: true
          };
          setProfile(defaultProfile);
          setEditDisplayName(defaultProfile.displayName || '');
          setEditHandle(defaultProfile.handle || '');
          setEditTitle(defaultProfile.title || '');
          setEditSpecialties(defaultProfile.specialties || '');
          setEditLocation(defaultProfile.location || '');
          setEditBio(defaultProfile.bio || '');
          setEditSkills(defaultProfile.skills || []);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Fetch user's projects
    const projectsQuery = query(
      collection(db, 'projects'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeProjects = onSnapshot(
      projectsQuery,
      (snap) => {
        setProjects(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      },
      (error) => {
        console.error('Error fetching projects:', error);
        const fallbackQuery = query(
          collection(db, 'projects'),
          where('creatorId', '==', user.uid)
        );
        onSnapshot(fallbackQuery, (snap) => {
          const projectsData = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          const sorted = projectsData.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || a.createdAt || 0;
            const bTime = b.createdAt?.toDate?.() || b.createdAt || 0;
            return bTime - aTime;
          });
          setProjects(sorted);
        });
      }
    );

    // Fetch user's marketplace listings
    const listingsQuery = query(
      collection(db, 'listings'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    // Fetch user's posted opportunities
    const opportunitiesQuery = query(
      collection(db, 'opportunities'),
      where('posterId', '==', user.uid),
      orderBy('posted', 'desc')
    );

    const unsubscribeListings = onSnapshot(
      listingsQuery,
      (snap) => {
        setListings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[]);
      },
      (error) => {
        console.error('Error fetching listings:', error);
        const fallbackQuery = query(
          collection(db, 'listings'),
          where('creatorId', '==', user.uid)
        );
        onSnapshot(fallbackQuery, (snap) => {
          const listingsData = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[];
          const sorted = listingsData.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || a.createdAt || 0;
            const bTime = b.createdAt?.toDate?.() || b.createdAt || 0;
            return bTime - aTime;
          });
          setListings(sorted);
        });
      }
    );

    const unsubscribeOpportunities = onSnapshot(
      opportunitiesQuery,
      (snap) => {
        const opps = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Opportunity[];
        setOpportunities(opps);
      },
      (error) => {
        console.error('Error fetching opportunities:', error);
        const fallbackQuery = query(
          collection(db, 'opportunities'),
          where('posterId', '==', user.uid)
        );
        onSnapshot(fallbackQuery, (snap) => {
          const opps = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Opportunity[];
          const sortedOpps = opps.sort((a, b) => {
            const aTime = a.posted?.toDate?.() || a.posted || 0;
            const bTime = b.posted?.toDate?.() || b.posted || 0;
            return bTime - aTime;
          });
          setOpportunities(sortedOpps);
        });
      }
    );

    return () => {
      unsubscribeProjects();
      unsubscribeListings();
      unsubscribeOpportunities();
    };
  }, [user]);

  const handleSaveProfile = async () => {
    if (!firebaseReady || !db || !user) return;
    
    try {
      const profileData: UserProfile = {
        displayName: editDisplayName,
        handle: editHandle,
        title: editTitle,
        specialties: editSpecialties,
        location: editLocation,
        bio: editBio,
        skills: editSkills,
        photoURL: user.photoURL || undefined,
      };
      
      // Update Firebase Auth
      if (auth.currentUser && editDisplayName) {
        await updateProfile(auth.currentUser, {
          displayName: editDisplayName
        });
      }
      
      // Update Firestore
      await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
      setProfile(profileData);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  const handleSaveSocial = async () => {
    if (!firebaseReady || !db || !user) return;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        linkedin: linkedin.trim(),
        instagram: instagram.trim().replace('@', ''),
        youtube: youtube.trim(),
      });
      alert('Social profiles saved successfully!');
    } catch (error) {
      console.error('Error saving social profiles:', error);
      alert('Failed to save social profiles. Please try again.');
    }
  };

  const handleSaveEmail = async () => {
    if (!firebaseReady || !db || !user) return;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        emailJobOpportunities,
        emailMarketplaceUpdates,
      });
      alert('Email preferences saved successfully!');
    } catch (error) {
      console.error('Error saving email preferences:', error);
      alert('Failed to save email preferences. Please try again.');
    }
  };

  const handleSavePrivacy = async () => {
    if (!firebaseReady || !db || !user) return;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        profilePublic,
      });
      setProfile({ ...profile, profilePublic });
      alert('Privacy settings saved successfully!');
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      alert('Failed to save privacy settings. Please try again.');
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !editSkills.includes(newSkill.trim())) {
      setEditSkills([...editSkills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const addSkillToProject = (skill: string) => {
    if (!projectSkills.includes(skill)) {
      setProjectSkills([...projectSkills, skill]);
    }
  };

  const removeSkillFromProject = (skill: string) => {
    setProjectSkills(projectSkills.filter(s => s !== skill));
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !projectSkills.includes(customSkill.trim())) {
      setProjectSkills([...projectSkills, customSkill.trim()]);
      setCustomSkill('');
    }
  };

  const handleFormatText = (format: string) => {
    const textarea = document.getElementById('projectContent') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = projectContent.substring(start, end);
    let formattedText = '';

    switch (format) {
      case 'H2':
        formattedText = selectedText ? `\n## ${selectedText}\n` : '\n## \n';
        break;
      case 'P':
        formattedText = selectedText ? `\n${selectedText}\n` : '\n\n';
        break;
      case 'B':
        formattedText = selectedText ? `**${selectedText}**` : '****';
        break;
      case 'I':
        formattedText = selectedText ? `*${selectedText}*` : '**';
        break;
      case 'UL':
        formattedText = selectedText ? `- ${selectedText}` : '- ';
        break;
      default:
        formattedText = selectedText;
    }

    const newContent = projectContent.substring(0, start) + formattedText + projectContent.substring(end);
    setProjectContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      const newPos = start + formattedText.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleProjectImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProjectImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProjectImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetProjectForm = () => {
    setProjectTitle('');
    setProjectDescription('');
    setProjectContent('');
    setProjectPreview('');
    setProjectUrl('');
    setProjectImage(null);
    setProjectImagePreview('');
    setProjectSkills([]);
    setCustomSkill('');
  };

  const handleAddProject = async () => {
    if (!projectTitle.trim()) {
      alert('Please enter a project title.');
      return;
    }

    if (!firebaseReady || !db || !user) {
      alert('Firebase is not configured.');
      return;
    }

    setProjectUploading(true);

    try {
      let imageUrl = '';

      if (projectImage && storage) {
        const storageRef = ref(storage, `project-images/${user.uid}/${Date.now()}_${projectImage.name}`);
        await uploadBytesResumable(storageRef, projectImage);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'projects'), {
        title: projectTitle,
        description: projectDescription,
        content: projectContent,
        preview: projectPreview,
        url: projectUrl,
        imageUrl,
        skills: projectSkills,
        creatorId: user.uid,
        createdAt: serverTimestamp(),
      });

      resetProjectForm();
      setShowProjectModal(false);
      alert('Project added successfully!');
    } catch (error) {
      console.error('Error adding project:', error);
      alert('Failed to add project. Please try again.');
    } finally {
      setProjectUploading(false);
    }
  };

  const removeSkill = (skill: string) => {
    setEditSkills(editSkills.filter(s => s !== skill));
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const displayName = profile.displayName || user?.displayName || user?.email?.split('@')[0] || 'Creator';
  const handle = profile.handle || user?.email?.split('@')[0] || '';
  const photoURL = profile.photoURL || user?.photoURL;

  if (loading) {
    return (
      <ProtectedRoute>
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="inline-block animate-spin  h-12 w-12 border-b-2 border-ccaBlue mb-4"></div>
              <p className="text-neutral-400">Loading your dashboard...</p>
            </div>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 w-full overflow-x-hidden">
        {/* Profile Section */}
        <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 mb-6 w-full overflow-x-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 w-full">
            {/* Left Side - Profile Info */}
            <div className="flex-1 w-full min-w-0">
              <div className="flex items-start gap-4 mb-4">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 overflow-hidden bg-neutral-800 border-2 border-neutral-700 flex-shrink-0">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl sm:text-3xl font-semibold bg-ccaBlue text-white">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold mb-1 truncate">{displayName}</h1>
                  {handle && <p className="text-neutral-400 mb-2 truncate">@{handle}</p>}
                  {profile.title && <p className="text-white mb-1 text-sm sm:text-base truncate">{profile.title}</p>}
                  {profile.specialties && (
                    <p className="text-red-500 mb-2 text-sm truncate">{profile.specialties}</p>
                  )}
                  {profile.location && (
                    <div className="flex items-center gap-1 text-neutral-300 mb-2 text-sm">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate">{profile.location}</span>
                    </div>
                  )}
                  {profile.bio && <p className="text-neutral-300 mb-3 text-sm line-clamp-2">{profile.bio}</p>}
                  {profile.skills && profile.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 sm:px-3 py-1 bg-neutral-800 text-neutral-300 text-xs border border-neutral-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side - Action Buttons */}
            <div className="flex flex-row md:flex-col gap-2 flex-shrink-0 w-full md:w-auto">
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 transition text-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="hidden sm:inline">Edit Profile</span>
                <span className="sm:hidden">Edit</span>
              </button>
              <button className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 transition text-sm whitespace-nowrap">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="hidden sm:inline">Share Profile</span>
                <span className="sm:hidden">Share</span>
              </button>
              <button className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 transition text-sm whitespace-nowrap">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <span className="hidden sm:inline">View Certificate</span>
                <span className="sm:hidden">Certificate</span>
              </button>
              <button className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 transition font-medium text-sm whitespace-nowrap">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="hidden sm:inline">Upgrade to Legacy+</span>
                <span className="sm:hidden">Upgrade</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 scrollbar-hide w-full -mx-3 sm:mx-0 px-3 sm:px-0">
          {(['projects', 'social', 'email', 'privacy', 'orders', 'onboarding'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 md:px-6 py-2 text-xs sm:text-sm font-medium transition whitespace-nowrap flex-shrink-0 rounded-lg ${
                activeTab === tab
                  ? 'bg-neutral-800/60 backdrop-blur-sm text-white border border-neutral-700/50'
                  : 'bg-neutral-900/60 backdrop-blur-sm text-neutral-400 hover:text-white border border-neutral-800/50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'projects' && (
          <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 w-full overflow-x-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl sm:text-2xl font-semibold">Projects</h2>
              <button 
                onClick={() => setShowProjectModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-white text-white hover:bg-white hover:text-black transition whitespace-nowrap w-full sm:w-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Project
              </button>
            </div>
            {projects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-400 mb-4">You haven't added any projects yet.</p>
                <button 
                  onClick={() => setShowProjectModal(true)}
                  className="flex items-center gap-2 px-6 py-3 border border-white text-white hover:bg-white hover:text-black transition mx-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Your First Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {projects.map((project) => (
                  <div key={project.id} className="border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-700 transition">
                    {project.imageUrl && (
                      <img src={project.imageUrl} alt={project.title} className="w-full h-48 object-cover mb-4" loading="lazy" decoding="async" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                    )}
                    <h3 className="font-semibold text-lg mb-2">{project.title}</h3>
                    {project.description && (
                      <p className="text-sm text-neutral-400 mb-4 line-clamp-2">{project.description}</p>
                    )}
                    {project.skills && project.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {project.skills.slice(0, 3).map((skill: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-neutral-800 text-neutral-300 text-xs border border-neutral-700">
                            {skill}
                          </span>
                        ))}
                        {project.skills.length > 3 && (
                          <span className="px-2 py-1 bg-neutral-800 text-neutral-300 text-xs border border-neutral-700">
                            +{project.skills.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {project.url && (
                      <a 
                        href={project.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-ccaBlue hover:text-ccaBlue/80 text-sm"
                      >
                        View Project →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'social' && (
          <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 w-full overflow-x-hidden">
            <h2 className="text-2xl font-semibold mb-6">Social Profiles</h2>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">LinkedIn</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    <input
                      type="text"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="johndoe"
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800  text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                    />
                  </div>
                  <button className="px-4 py-2  border border-white text-white hover:bg-white hover:text-black transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-neutral-500 mt-1">Just the profile identifier (e.g., "john-doe-123" not full URL)</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">Instagram</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    <input
                      type="text"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="johndoe"
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800  text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                    />
                  </div>
                  <button className="px-4 py-2  border border-white text-white hover:bg-white hover:text-black transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-neutral-500 mt-1">Just the username (e.g., "johndoe" not "@johndoe" or full URL)</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">YouTube</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <input
                      type="text"
                      value={youtube}
                      onChange={(e) => setYoutube(e.target.value)}
                      placeholder="johndoe"
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800  text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                    />
                  </div>
                  <button className="px-4 py-2  border border-white text-white hover:bg-white hover:text-black transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-neutral-500 mt-1">Just the handle (e.g., "johndoe" not "@johndoe" or full URL)</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveSocial}
                className="px-6 py-2  bg-red-500 text-white hover:bg-red-600 transition"
              >
                Save Social Profiles
              </button>
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 w-full overflow-x-hidden">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <h2 className="text-2xl font-semibold">Email Preferences</h2>
            </div>
            <p className="text-neutral-400 mb-6">Stay updated with the latest opportunities and content from our platform</p>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between p-4  bg-neutral-900 border border-neutral-800">
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Job Opportunities</h3>
                  <p className="text-sm text-neutral-400">Receive weekly emails with the newest job listings matching your specialty</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailJobOpportunities}
                    onChange={(e) => setEmailJobOpportunities(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ccaBlue/20  peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after: after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4  bg-neutral-900 border border-neutral-800">
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Marketplace Updates</h3>
                  <p className="text-sm text-neutral-400">Get notified about new marketplace listings and exclusive deals from creators</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailMarketplaceUpdates}
                    onChange={(e) => setEmailMarketplaceUpdates(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ccaBlue/20  peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after: after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveEmail}
                className="px-6 py-2  bg-red-500 text-white hover:bg-red-600 transition"
              >
                Save Email Preferences
              </button>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 w-full overflow-x-hidden">
            <h2 className="text-2xl font-semibold mb-2">Privacy Settings</h2>
            <p className="text-neutral-400 mb-6">Control who can see your profile and information</p>
            
            <div className="space-y-6 mb-6">
              <div>
                <h3 className="font-semibold mb-2">Profile Visibility</h3>
                <div className="flex items-center justify-between p-4  bg-neutral-900 border border-neutral-800">
                  <div className="flex-1">
                    <p className="font-medium mb-1">Make profile public</p>
                    <p className="text-sm text-neutral-400">When enabled, your profile will appear in public directories and search results.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profilePublic}
                      onChange={(e) => setProfilePublic(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ccaBlue/20  peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after: after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    <span className="ml-3 text-sm font-medium">{profilePublic ? 'Public' : 'Private'}</span>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Current Status</h3>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3  bg-green-500"></div>
                  <span className="text-sm">
                    Profile: <span className="font-medium">{profilePublic ? 'Public' : 'Private'}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSavePrivacy}
                className="px-6 py-2  bg-red-500 text-white hover:bg-red-600 transition"
              >
                Save Privacy Settings
              </button>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 w-full overflow-x-hidden">
            <OrdersTab />
          </div>
        )}

        {activeTab === 'onboarding' && (
          <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 w-full overflow-x-hidden">
            <OnboardingTab />
          </div>
        )}

        {/* Marketplace Listings */}
        {activeTab === 'projects' && listings.length > 0 && (
          <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 mt-6 w-full overflow-x-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">My Marketplace Listings</h2>
              <Link
                href="/marketplace"
                className="text-sm text-ccaBlue hover:text-ccaBlue/80 whitespace-nowrap"
              >
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {listings.slice(0, 3).map((listing) => (
                <div
                  key={listing.id}
                  className=" overflow-hidden border border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition-all"
                >
                  <div className="relative h-64 bg-neutral-900 overflow-hidden">
                    {listing.images && listing.images.length > 0 ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full bg-neutral-800 flex items-center justify-center ${listing.images && listing.images.length > 0 ? 'hidden' : ''}`}>
                      <span className="text-neutral-600 text-sm">No Image</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-1 line-clamp-1">{listing.title}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl font-bold text-white">${listing.price}</span>
                      {listing.shipping !== undefined && listing.shipping > 0 ? (
                        <span className="text-sm text-neutral-400">+ ${listing.shipping} shipping</span>
                      ) : (
                        <span className="text-sm text-green-400">Free shipping</span>
                      )}
                    </div>
                    {listing.description && (
                      <p className="text-sm text-neutral-300 mb-3 line-clamp-2">{listing.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-800">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6  bg-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-400">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="text-xs text-neutral-500">
                          <div>{user?.email?.split('@')[0] || 'Creator'}</div>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {listing.condition}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunities */}
        {activeTab === 'projects' && opportunities.length > 0 && (
          <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 mt-6 w-full overflow-x-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">My Posted Opportunities</h2>
              <Link
                href="/opportunities"
                className="text-sm text-ccaBlue hover:text-ccaBlue/80 whitespace-nowrap"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {opportunities.slice(0, 3).map((opp) => (
                <div
                  key={opp.id}
                  className=" border border-neutral-800 bg-neutral-900 p-4"
                >
                  <div className="font-semibold text-lg">{opp.title}</div>
                  <div className="text-sm text-neutral-400">{opp.company} • {opp.location}</div>
                  <div className="text-xs text-neutral-500 mt-1">{opp.type}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit Profile Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
            <div className="bg-neutral-950 border border-neutral-800 p-4 sm:p-6 max-w-2xl w-full mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl sm:text-2xl font-semibold pr-2">Edit Profile</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-neutral-400 hover:text-white transition p-1 rounded-lg hover:bg-neutral-800 flex-shrink-0"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Display Name *</label>
                  <input
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800  px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Handle</label>
                  <input
                    value={editHandle}
                    onChange={(e) => setEditHandle(e.target.value.replace('@', ''))}
                    placeholder="johndoe"
                    className="w-full bg-neutral-900 border border-neutral-800  px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Title</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g., Videographer, Editor"
                    className="w-full bg-neutral-900 border border-neutral-800  px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Specialties</label>
                  <input
                    value={editSpecialties}
                    onChange={(e) => setEditSpecialties(e.target.value)}
                    placeholder="e.g., Real Estate, Ads, And Commercials"
                    className="w-full bg-neutral-900 border border-neutral-800  px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Location</label>
                  <input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="e.g., Atlanta, Ga"
                    className="w-full bg-neutral-900 border border-neutral-800  px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Bio</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                    className="w-full bg-neutral-900 border border-neutral-800  px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Skills</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="flex items-center gap-2 px-3 py-1  bg-neutral-800 text-neutral-300 text-sm border border-neutral-700"
                      >
                        {skill}
                        <button
                          onClick={() => removeSkill(skill)}
                          className="hover:text-white"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                      placeholder="Add a skill"
                      className="flex-1 bg-neutral-900 border border-neutral-800  px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                    />
                    <button
                      onClick={addSkill}
                      className="px-4 py-2  bg-neutral-800 border border-neutral-700 text-white hover:bg-neutral-700 transition"
                    >
                      Add
                    </button>
                  </div>
                  <div className="mt-4">
                    <ProfileImageUpload />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSaveProfile}
                    className="px-6 py-2  bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue font-medium transition-all"
                  >
                    Save Profile
                  </button>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-6 py-2  bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add New Project Modal */}
        {showProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
            <div className="bg-neutral-950 border border-neutral-800 p-4 sm:p-6 max-w-3xl w-full mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-lg">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-semibold pr-2">Add New Project</h2>
                <button
                  onClick={() => {
                    resetProjectForm();
                    setShowProjectModal(false);
                  }}
                  className="text-neutral-400 hover:text-white transition p-1 rounded-lg hover:bg-neutral-800 flex-shrink-0"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Project Title</label>
                  <input
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                    placeholder="Enter project title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Short Description</label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue resize-none"
                    placeholder="Brief description of your project"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Project Content</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {['H2', 'P', 'B', 'I', 'UL'].map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => handleFormatText(format)}
                        className="px-2 sm:px-3 py-1 bg-neutral-800 border border-neutral-700 text-white hover:bg-neutral-700 transition text-xs sm:text-sm"
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="projectContent"
                    value={projectContent}
                    onChange={(e) => setProjectContent(e.target.value)}
                    rows={10}
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue resize-none"
                    placeholder="Enter project content..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Preview</label>
                  <textarea
                    value={projectPreview}
                    onChange={(e) => setProjectPreview(e.target.value)}
                    rows={4}
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue resize-none"
                    placeholder="Preview text"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Project URL</label>
                  <input
                    type="url"
                    value={projectUrl}
                    onChange={(e) => setProjectUrl(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                    placeholder="https://example.com/project"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Project Image</label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer">
                      <span className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 transition inline-block">
                        Choose File
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProjectImageChange}
                        className="hidden"
                      />
                    </label>
                    <span className="text-neutral-400 text-sm">
                      {projectImage ? projectImage.name : 'No file chosen'}
                    </span>
                  </div>
                  {projectImagePreview && (
                    <div className="mt-4">
                      <img src={projectImagePreview} alt="Preview" className="max-w-full h-64 object-contain border border-neutral-800" loading="lazy" decoding="async" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Skills Used</label>
                  <div className="mb-4">
                    <p className="text-sm text-neutral-400 mb-2">Recommended skills:</p>
                    <div className="flex flex-wrap gap-2">
                      {recommendedSkills.map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => addSkillToProject(skill)}
                          disabled={projectSkills.includes(skill)}
                          className={`px-3 py-1 text-sm border transition ${
                            projectSkills.includes(skill)
                              ? 'bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed'
                              : 'bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800'
                          }`}
                        >
                          + {skill}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customSkill}
                      onChange={(e) => setCustomSkill(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCustomSkill()}
                      placeholder="Add a custom skill and press Enter"
                      className="flex-1 bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                    />
                    <button
                      type="button"
                      onClick={addCustomSkill}
                      className="px-4 py-2 bg-neutral-900 border border-neutral-700 text-white hover:bg-neutral-800 transition"
                    >
                      +
                    </button>
                  </div>
                  {projectSkills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {projectSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="flex items-center gap-2 px-3 py-1 bg-neutral-800 text-neutral-300 text-sm border border-neutral-700"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeSkillFromProject(skill)}
                            className="hover:text-white"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      resetProjectForm();
                      setShowProjectModal(false);
                    }}
                    className="px-6 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddProject}
                    disabled={projectUploading || !projectTitle.trim()}
                    className="px-6 py-2 bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {projectUploading ? 'Adding...' : 'Add Project'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
