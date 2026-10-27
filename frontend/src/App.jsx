import React, { useEffect, useMemo, useRef, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';
const MAX_RESUME_CHARACTERS = 16000;
const JOB_ARTWORK = [
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85',
];

function JobArtwork({ job, index }) {
  return (
    <div className="job-card-artwork">
      <img src={JOB_ARTWORK[index % JOB_ARTWORK.length]} alt="" loading="lazy" />
      <span className="job-artwork-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M8 7V5.75A1.75 1.75 0 0 1 9.75 4h4.5A1.75 1.75 0 0 1 16 5.75V7m-12 0h16a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1Zm-1 5h18m-11 0v2h4v-2" /></svg>
      </span>
      <span className="job-artwork-label">{job.department || 'Technology'}</span>
    </div>
  );
}

function JobCategoryFilters({ categories, selectedCategory, onSelect }) {
  return (
    <div className="job-category-filters" role="group" aria-label="Filter jobs by category">
      {['All roles', ...categories].map((category) => {
        const value = category === 'All roles' ? 'all' : category;
        return (
          <button
            type="button"
            key={value}
            className={selectedCategory === value ? 'active' : ''}
            aria-pressed={selectedCategory === value}
            onClick={() => onSelect(value)}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}

async function extractResumeText(file) {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${API}/resumes/parse`, { method: 'POST', body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || 'Unable to read this resume.');
  return data.text;
}

function parseGeneratedReport(text) {
  try {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return { summary: text, matching_skills: [], missing_or_unclear_skills: [], recommendations: [] };
  }
}

async function request(path, options = {}) {
  const response = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }
  return data;
}

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem('hirewise-session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [jobs, setJobs] = useState([]);
  const [applicantApplications, setApplicantApplications] = useState([]);
  const [recruiterApplications, setRecruiterApplications] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const noticeTimer = useRef(null);

  function showNotice(message) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2000);
  }

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    if (session) {
      localStorage.setItem('hirewise-session', JSON.stringify(session));
    } else {
      localStorage.removeItem('hirewise-session');
    }
  }, [session]);

  async function loadOpenJobs() {
    const data = await request('/jobs/open');
    setJobs(data);
  }

  async function loadRecruiterJobs() {
    const data = await request('/jobs');
    setJobs(data);
  }

  async function loadRecruiterApplications() {
    const data = await request('/recruiter/applications');
    setRecruiterApplications(data);
  }

  async function loadCandidateApplications() {
    if (!session || !session.user?.id) return;
    const data = await request(`/candidates/${session.user.id}/applications`);
    setApplicantApplications(data);
  }

  useEffect(() => {
    if (!session) return;
    if (session.role === 'CANDIDATE') {
      loadOpenJobs().catch(() => showNotice('Unable to load open jobs.'));
      loadCandidateApplications().catch(() => showNotice('Unable to load your applications.'));
    }
    if (session.role === 'RECRUITER') {
      loadRecruiterJobs().catch(() => showNotice('Unable to load jobs.'));
      loadRecruiterApplications().catch(() => showNotice('Unable to load applications.'));
    }
  }, [session]);

  async function action(fn) {
    setBusy(true);
    setNotice('');
    try {
      await fn();
    } catch (error) {
      showNotice(error.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return <AuthScreen onLogin={setSession} />;
  }

  if (session.role === 'CANDIDATE') {
    return (
      <CandidateDashboard
        session={session}
        jobs={jobs}
        applications={applicantApplications}
        busy={busy}
        notice={notice}
        setNotice={showNotice}
        setSession={setSession}
        action={action}
        loadOpenJobs={loadOpenJobs}
        loadCandidateApplications={loadCandidateApplications}
      />
    );
  }

  return (
    <RecruiterDashboard
      session={session}
      jobs={jobs}
      applications={recruiterApplications}
      setRecruiterApplications={setRecruiterApplications}
      busy={busy}
      notice={notice}
      setNotice={showNotice}
      setSession={setSession}
      action={action}
      loadRecruiterJobs={loadRecruiterJobs}
      loadRecruiterApplications={loadRecruiterApplications}
    />
  );
}

function AuthScreen({ onLogin }) {
  const [role, setRole] = useState('candidate');
  const [mode, setMode] = useState('login');
  const [candidateForm, setCandidateForm] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
  });
  const [recruiterForm, setRecruiterForm] = useState({
    username: '',
    password: '',
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
  });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      if (role === 'candidate') {
        const payload = mode === 'login'
          ? { username: candidateForm.username, password: candidateForm.password }
          : { ...candidateForm };
        const endpoint = mode === 'login' ? '/auth/candidate/login' : '/auth/candidate/register';
        const response = await request(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onLogin({ role: 'CANDIDATE', user: response.user || response });
      } else {
        const payload = mode === 'login'
          ? { username: recruiterForm.username, password: recruiterForm.password }
          : { ...recruiterForm };
        const endpoint = mode === 'login' ? '/auth/recruiter/login' : '/auth/recruiter/register';
        const response = await request(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onLogin({ role: 'RECRUITER', user: response.user || response });
      }
    } catch (error) {
      setNotice(error.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = role === 'candidate' ? 'Candidate' : 'Recruiter';

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-block">
          <div className="brand-icon">T</div>
          <div>
            <div className="brand-name">TalentSelect</div>
            <div className="brand-subtitle">Find your next opportunity</div>
          </div>
        </div>

        <div className="role-toggle">
          <button className={role === 'candidate' ? 'active' : ''} onClick={() => setRole('candidate')}>Candidate</button>
          <button className={role === 'recruiter' ? 'active' : ''} onClick={() => setRole('recruiter')}>Recruiter</button>
        </div>

        <div className="auth-header">
          <h2>{mode === 'login' ? `Login as ${roleLabel}` : `Create ${roleLabel} account`}</h2>
          <button className="text-btn" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
        </div>

        {notice && <div className="notice">{notice}</div>}

        <form onSubmit={submitAuth} className="auth-form">
          {role === 'candidate' ? (
            <>
              <label>
                Username
                <input required autoComplete="username" value={candidateForm.username} onChange={(event) => setCandidateForm({ ...candidateForm, username: event.target.value })} />
              </label>
              <label>
                Password
                <input required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={candidateForm.password} onChange={(event) => setCandidateForm({ ...candidateForm, password: event.target.value })} />
              </label>
              {mode === 'register' && (
                <>
                  <label>
                    Full name
                    <input required value={candidateForm.name} onChange={(event) => setCandidateForm({ ...candidateForm, name: event.target.value })} />
                  </label>
                  <label>
                    Email
                    <input required type="email" value={candidateForm.email} onChange={(event) => setCandidateForm({ ...candidateForm, email: event.target.value })} />
                  </label>
                  <label>
                    Phone
                    <input value={candidateForm.phone} onChange={(event) => setCandidateForm({ ...candidateForm, phone: event.target.value })} />
                  </label>
                </>
              )}
            </>
          ) : (
            <>
              <label>
                Username
                <input required autoComplete="username" value={recruiterForm.username} onChange={(event) => setRecruiterForm({ ...recruiterForm, username: event.target.value })} />
              </label>
              <label>
                Password
                <input required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={recruiterForm.password} onChange={(event) => setRecruiterForm({ ...recruiterForm, password: event.target.value })} />
              </label>
              {mode === 'register' && (
                <>
                  <label>
                    Full name
                    <input required value={recruiterForm.fullName} onChange={(event) => setRecruiterForm({ ...recruiterForm, fullName: event.target.value })} />
                  </label>
                  <label>
                    Company name
                    <input required value={recruiterForm.companyName} onChange={(event) => setRecruiterForm({ ...recruiterForm, companyName: event.target.value })} />
                  </label>
                  <label>
                    Email
                    <input required type="email" value={recruiterForm.email} onChange={(event) => setRecruiterForm({ ...recruiterForm, email: event.target.value })} />
                  </label>
                  <label>
                    Phone
                    <input value={recruiterForm.phone} onChange={(event) => setRecruiterForm({ ...recruiterForm, phone: event.target.value })} />
                  </label>
                </>
              )}
            </>
          )}

          <button type="submit" className="primary full-width" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}

function getApplicationTimeline(applications, period) {
  const currentDate = new Date();
  const today = new Date(currentDate);
  today.setHours(23, 59, 59, 999);
  if (period === 'year') {
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - 11 + index, 1);
      const nextDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const count = applications.filter((application) => {
        const createdAt = application.createdAt ? new Date(application.createdAt) : null;
        return createdAt && createdAt >= date && createdAt < nextDate;
      }).length;
      return { label: date.toLocaleDateString(undefined, { month: 'short' }), detail: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), count };
    });
  }

  const dayCount = period === 'month' ? 30 : 7;
  const bucketCount = period === 'month' ? 6 : 7;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const startOffset = period === 'month' ? index * 5 : index;
    const endOffset = period === 'month' ? startOffset + 5 : startOffset + 1;
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayCount + startOffset + 1);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayCount + endOffset + 1);
    end.setHours(0, 0, 0, 0);
    const count = applications.filter((application) => {
      const createdAt = application.createdAt ? new Date(application.createdAt) : null;
      return createdAt && createdAt >= start && createdAt < end;
    }).length;
    const options = period === 'month' ? { month: 'short', day: 'numeric' } : { weekday: 'short' };
    return {
      label: period === 'month' ? start.toLocaleDateString(undefined, options) : start.toLocaleDateString(undefined, options),
      detail: period === 'month'
        ? `${start.toLocaleDateString()} – ${new Date(end.getTime() - 1).toLocaleDateString()}`
        : start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
      count,
      isToday: currentDate >= start && currentDate < end,
    };
  });
  return buckets;
}

function getApplicationsForPeriod(applications, period) {
  const today = new Date();
  const start = period === 'year'
    ? new Date(today.getFullYear(), today.getMonth() - 11, 1)
    : new Date(today.getFullYear(), today.getMonth(), today.getDate() - (period === 'month' ? 29 : 6));
  return applications.filter((application) => application.createdAt && new Date(application.createdAt) >= start);
}

function WeeklyApplicationsChart({ applications, period, setPeriod }) {
  const data = getApplicationTimeline(applications, period);
  const max = Math.max(1, ...data.map((day) => day.count));
  const periodLabel = period === 'week' ? 'Last 7 days' : period === 'month' ? 'Last 30 days' : 'Last 12 months';

  return (
    <section className="panel chart-panel weekly-chart">
      <div className="panel-head">
        <div><h3>Application activity</h3><p>{periodLabel} · Hover over a bar for details</p></div>
        <label className="chart-period-select">
          <span className="sr-only">Chart time period</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </label>
      </div>
      <div className={`bar-chart bar-chart-${period}`} role="img" aria-label={`Applications for ${periodLabel}: ${data.map((day) => `${day.detail}: ${day.count}`).join(', ')}`} style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((day) => (
          <div className={`bar-day${day.isToday ? ' today' : ''}`} key={day.detail} title={`${day.detail}: ${day.count} application${day.count === 1 ? '' : 's'}`}>
            <span className="bar-value">{day.count || ''}</span>
            <div className="bar-track"><span className="bar-fill" style={{ height: `${day.count ? Math.max(10, (day.count / max) * 100) : 4}%` }} /></div>
            <span className="bar-label">{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ApplicationStatusChart({ applications, period }) {
  const filteredApplications = getApplicationsForPeriod(applications, period);
  const counts = [
    { key: 'PENDING', label: 'In review', color: '#8874e9' },
    { key: 'SELECTED', label: 'Selected', color: '#40b99b' },
    { key: 'REJECTED', label: 'Not selected', color: '#e57991' },
  ].map((item) => ({ ...item, count: filteredApplications.filter((application) => application.status === item.key).length }));
  const total = filteredApplications.length;
  let progress = 0;
  const gradient = counts.map((item) => {
    const start = progress;
    progress += total ? (item.count / total) * 100 : 0;
    return `${item.color} ${start}% ${progress}%`;
  }).join(', ');

  return (
    <section className="panel chart-panel status-chart">
      <div className="panel-head">
        <div><h3>Application outcomes</h3><p>{period === 'week' ? 'Last 7 days' : period === 'month' ? 'Last 30 days' : 'Last 12 months'} · Hover for counts</p></div>
        <span className="chart-icon">◉</span>
      </div>
      <div className="donut-layout" title={counts.map((item) => `${item.label}: ${item.count}`).join(' · ')}>
        <div className="donut-chart" style={{ '--donut-gradient': total ? `conic-gradient(${gradient})` : 'conic-gradient(#e9eaf2 0 100%)' }} role="img" aria-label={`${total} total applications`}>
          <span><strong>{total}</strong><small>Total</small></span>
        </div>
        <div className="donut-legend">
          {counts.map((item) => (
            <div className="legend-item" key={item.key}>
              <span className="legend-dot" style={{ '--legend-color': item.color }} />
              <span>{item.label}</span><strong>{item.count}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnimatedAtsScore({ value, animate }) {
  const score = Number(value) || 0;
  const [displayedScore, setDisplayedScore] = useState(score);
  const previousScore = useRef(score);

  useEffect(() => {
    const startScore = previousScore.current;
    previousScore.current = score;
    if (!animate || startScore === score) {
      setDisplayedScore(score);
      return undefined;
    }

    let frame;
    const startTime = performance.now();
    function updateScore(time) {
      const progress = Math.min((time - startTime) / 650, 1);
      setDisplayedScore(Math.round(startScore + (score - startScore) * progress));
      if (progress < 1) frame = window.requestAnimationFrame(updateScore);
    }
    frame = window.requestAnimationFrame(updateScore);
    return () => window.cancelAnimationFrame(frame);
  }, [score, animate]);

  return <strong className={animate ? 'score-updated' : ''}>{displayedScore}<small>/100</small></strong>;
}

function CandidateDashboard({ session, jobs, applications, busy, notice, setNotice, setSession, action, loadOpenJobs, loadCandidateApplications }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetail, setJobDetail] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activePage, setActivePage] = useState('home');
  const [chartPeriod, setChartPeriod] = useState('week');
  const [searchTerm, setSearchTerm] = useState('');
  const [jobFilter, setJobFilter] = useState('all');
  const [jobCategory, setJobCategory] = useState('all');
  const [savedJobIds, setSavedJobIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`hirewise-saved-jobs-${session.user.id}`) || '[]');
    } catch {
      return [];
    }
  });
  const [matchResumeText, setMatchResumeText] = useState('');
  const [matchResumeFileName, setMatchResumeFileName] = useState('');
  const [matchJobId, setMatchJobId] = useState('');
  const [matchReport, setMatchReport] = useState(null);
  const [matchReportOpen, setMatchReportOpen] = useState(false);
  const [matching, setMatching] = useState(false);
  const [applicationForm, setApplicationForm] = useState({
    jobId: '',
    candidateId: session.user.id,
    resumeText: session.user.resumeText || '',
    resumeFileName: '',
    phone: session.user.phone || '',
    education: session.user.education || '',
    experienceSummary: '',
    skills: session.user.skills || '',
  });
  const [profileForm, setProfileForm] = useState({
    name: session.user.name || '',
    email: session.user.email || '',
    phone: session.user.phone || '',
    education: session.user.education || '',
    skills: session.user.skills || '',
    summary: session.user.summary || '',
  });

  useEffect(() => {
    const user = session.user || {};
    setApplicationForm((current) => ({
      ...current,
      candidateId: user.id,
      phone: user.phone || current.phone || '',
      education: user.education || current.education || '',
      skills: user.skills || current.skills || '',
      resumeText: user.resumeText || current.resumeText || '',
    }));
    setProfileForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      education: user.education || '',
      skills: user.skills || '',
      summary: user.summary || '',
    });
  }, [session.user]);

  useEffect(() => {
    localStorage.setItem(`hirewise-saved-jobs-${session.user.id}`, JSON.stringify(savedJobIds));
  }, [savedJobIds, session.user.id]);

  useEffect(() => {
    if (selectedJob) {
      setApplicationForm((current) => ({ ...current, jobId: selectedJob.id }));
    }
  }, [selectedJob]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    return jobs.filter((job) => {
      const searchable = [job.title, job.companyName, job.location, job.department, ...(job.requiredSkills || [])].join(' ').toLowerCase();
      const matchesSearch = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesFilter = jobFilter === 'all' || (job.employmentType || '').toLowerCase() === jobFilter.toLowerCase();
      const matchesCategory = jobCategory === 'all' || (job.department || 'Technology') === jobCategory;
      return matchesSearch && matchesFilter && matchesCategory;
    });
  }, [jobs, searchTerm, jobFilter, jobCategory]);
  const jobCategories = useMemo(() => [...new Set(jobs.map((job) => job.department || 'Technology'))].sort(), [jobs]);
  const appliedJobIds = useMemo(() => new Set(applications.map((application) => application.job?.id)), [applications]);
  const pageJobs = activePage === 'saved' ? jobs.filter((job) => savedJobIds.includes(job.id)) : filteredJobs;
  const savedJobs = jobs.filter((job) => savedJobIds.includes(job.id));

  const stats = useMemo(() => ({
    jobs: jobs.length,
    applications: applications.length,
    selected: applications.filter((item) => item.status === 'SELECTED').length,
  }), [jobs, applications]);
  const pageApplications = applications.filter((application) => (
    activePage === 'selected' ? application.status === 'SELECTED'
      : activePage === 'rejected' ? application.status === 'REJECTED'
        : true
  ));
  const pageTitle = {
    home: `Welcome, ${session.user.name || session.user.username}`,
    jobs: 'Search jobs',
    saved: 'Saved jobs',
    aiMatch: 'AI Match',
    applications: 'My applications',
    selected: 'Selected applications',
    rejected: 'Rejected applications',
  }[activePage];

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setNotice('Resume files must be 10 MB or smaller.');
      event.target.value = '';
      return;
    }
    try {
      const text = await extractResumeText(file);
      if (text.length > MAX_RESUME_CHARACTERS) throw new Error(`Resume must be ${MAX_RESUME_CHARACTERS.toLocaleString()} characters or fewer.`);
      setApplicationForm((current) => ({ ...current, resumeText: text, resumeFileName: file.name }));
      setNotice('Resume uploaded and read successfully.');
    } catch (error) {
      setNotice(error.message || 'Unable to read this resume.');
      event.target.value = '';
    }
  }

  async function handleMatchResumeUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setNotice('Resume files must be 10 MB or smaller.');
      event.target.value = '';
      return;
    }
    try {
      const text = await extractResumeText(file);
      setMatchResumeText(text);
      setMatchResumeFileName(file.name);
      setMatchReport(null);
      setMatchReportOpen(false);
      setNotice('Resume uploaded and read successfully.');
    } catch (error) {
      setNotice(error.message || 'Unable to read this resume.');
      event.target.value = '';
    }
  }

  async function submitMatch(event) {
    event.preventDefault();
    const job = savedJobs.find((item) => String(item.id) === String(matchJobId));
    if (!job || !matchResumeText.trim()) {
      setNotice('Upload a resume and choose one of your saved jobs.');
      return;
    }
    setMatching(true);
    setMatchReport(null);
    try {
      const result = await request('/match', {
        method: 'POST',
        body: JSON.stringify({ jobDescription: job.description, resumeText: matchResumeText }),
      });
      setMatchReport({ ...parseGeneratedReport(result.analysis || ''), atsScore: result.atsScore, notice: result.notice });
    } catch (error) {
      setNotice(error.message || 'Unable to analyze this match.');
    } finally {
      setMatching(false);
    }
  }

  async function submitApplication(event) {
    event.preventDefault();
    if (appliedJobIds.has(selectedJob?.id)) {
      setNotice('You have already applied for this job.');
      return;
    }
    const resumeText = (applicationForm.resumeText || session.user.resumeText || '').trim();
    if (!resumeText) {
      setNotice('Please add a resume in your profile or upload one before submitting.');
      return;
    }

    await action(async () => {
      await request('/applications', {
        method: 'POST',
        body: JSON.stringify({
          ...applicationForm,
          candidateId: session.user.id,
          resumeText,
          skills: applicationForm.skills || profileForm.skills || '',
          education: applicationForm.education || profileForm.education || '',
          phone: applicationForm.phone || profileForm.phone || '',
        }),
      });
      setSelectedJob(null);
      setApplicationForm((current) => ({
        ...current,
        resumeText: session.user.resumeText || '',
        resumeFileName: '',
        experienceSummary: '',
      }));
      await loadOpenJobs();
      await loadCandidateApplications();
      setNotice('Application submitted successfully.');
    });
  }

  async function saveProfile(event) {
    event.preventDefault();
    await action(async () => {
      const updatedUser = await request(`/candidates/${session.user.id}/profile`, {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      });
      setSession((current) => (current ? { ...current, user: { ...current.user, ...updatedUser } } : current));
      setApplicationForm((current) => ({
        ...current,
        phone: profileForm.phone || current.phone,
        education: profileForm.education || current.education,
        skills: profileForm.skills || current.skills,
      }));
      setProfileOpen(false);
      setNotice('Profile updated successfully.');
    });
  }

  async function revokeApplication(application) {
    if (!window.confirm(`Revoke your application for "${application.job?.title || 'this role'}"?`)) return;
    await action(async () => {
      await request(`/candidates/${session.user.id}/applications/${application.id}`, { method: 'DELETE' });
      await loadCandidateApplications();
      setNotice('Application revoked.');
    });
  }

  return (
    <div className="app-shell candidate-app">
      <header className="top-nav">
        <div className="brand-block">
          <div className="brand-icon">T</div>
          <div className="brand-name">TalentSelect</div>
        </div>
        <nav className="top-nav-links">
          <label className="nav-search" aria-label="Search jobs">
            <span>⌕</span>
            <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search jobs, skills, companies" />
          </label>
          <button type="button" className={activePage === 'home' ? 'active' : ''} onClick={() => setActivePage('home')}>Home</button>
          <button type="button" className={activePage === 'jobs' ? 'active' : ''} onClick={() => setActivePage('jobs')}>Jobs</button>
          <button type="button" className={activePage === 'saved' ? 'active' : ''} onClick={() => setActivePage('saved')}>Saved</button>
          <button type="button" className={activePage === 'aiMatch' ? 'active' : ''} onClick={() => setActivePage('aiMatch')}>AI Match</button>
          <label className={`nav-application-select ${['applications', 'selected', 'rejected'].includes(activePage) ? 'active' : ''}`}>
            <span>My applications</span>
            <select aria-label="My applications" value={activePage === 'selected' ? 'selected' : activePage === 'rejected' ? 'rejected' : 'applications'} onChange={(event) => setActivePage(event.target.value)}>
              <option value="applications">All applications</option>
              <option value="selected">Selected</option>
              <option value="rejected">Rejected</option>
            </select>
            <span className="select-chevron">⌄</span>
          </label>
        </nav>
        <div className="nav-account">
          <button type="button" className="profile-button" onClick={() => setProfileOpen(true)}>
            <span className="avatar">{(session.user.name || session.user.username || 'C').slice(0, 1).toUpperCase()}</span>
            <span>Profile</span>
          </button>
          <button className="nav-logout" onClick={() => setSession(null)}>Logout</button>
        </div>
      </header>

      <main className="main-panel">
        <header className="page-header">
          <div>
            <div className="eyebrow">{activePage === 'home' ? 'Candidate dashboard' : activePage === 'jobs' || activePage === 'saved' ? 'Explore opportunities' : activePage === 'aiMatch' ? 'Resume insights' : 'Your applications'}</div>
            <h1>{pageTitle}</h1>
          </div>
        </header>

        {notice && <div className="toast" role="status">{notice}</div>}

        {activePage === 'home' && <section className="workspace-hero candidate-hero">
          <img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=2000&q=90" alt="Technology colleagues collaborating in a bright modern workspace" />
          <div className="workspace-hero-content">
            <span className="hero-kicker"><span className="hero-sparkle" aria-hidden="true">✦</span> MAKE YOUR NEXT MOVE</span>
            <h2>Find work that moves you forward.</h2>
            <p>Explore thoughtful opportunities from teams building what’s next.</p>
            <button className="primary" type="button" onClick={() => setActivePage('jobs')}>Explore open roles <span aria-hidden="true">→</span></button>
          </div>
          <div className="hero-image-caption"><span className="hero-caption-icon">✦</span> Your next chapter starts here</div>
        </section>}

        {activePage === 'home' && <section className="stats-grid">
          <div className="stat-card"><span>Open jobs</span><strong>{stats.jobs}</strong></div>
          <div className="stat-card"><span>Applications</span><strong>{stats.applications}</strong></div>
          <div className="stat-card"><span>Selected</span><strong>{stats.selected}</strong></div>
        </section>}

        {activePage === 'home' && <>
          <div className="analytics-grid">
            <WeeklyApplicationsChart applications={applications} period={chartPeriod} setPeriod={setChartPeriod} />
            <ApplicationStatusChart applications={applications} period={chartPeriod} />
          </div>
          <section className="panel latest-applications-panel">
            <div className="panel-head">
              <div><h3>Latest applications</h3><p>Your most recent submissions</p></div>
              <button className="text-btn" type="button" onClick={() => setActivePage('applications')}>View all</button>
            </div>
            {applications.length === 0 ? <div className="empty-state">Your latest applications will appear here.</div> : (
              <div className="latest-application-grid">
                {[...applications].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3).map((app) => (
                  <button type="button" className="latest-application-card" key={app.id} onClick={() => setSelectedApplication(app)}>
                    <span className={`latest-status-icon ${app.status?.toLowerCase() || 'pending'}`}>{app.status === 'SELECTED' ? '✓' : app.status === 'REJECTED' ? '×' : '◷'}</span>
                    <span><strong>{app.job?.title || 'Role'}</strong><small>{app.job?.companyName || 'Company'} · {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'Recently'}</small></span>
                    <span className={`status-badge ${app.status?.toLowerCase()}`}>{app.status}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>}

        {['jobs', 'saved'].includes(activePage) && <div className="content-grid">
          <section className="panel" id="jobs">
            <div className="panel-head">
              <div>
                <h3>{activePage === 'saved' ? 'Your saved roles' : 'Open roles'}</h3>
                <p>{activePage === 'saved' ? 'Jobs you bookmarked for later' : 'Browse and apply to live opportunities'}</p>
              </div>
            </div>

            {activePage === 'jobs' && <div className="search-controls">
              <select value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
                <option value="all">All work modes</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
                <option value="internship">Internship</option>
              </select>
            </div>}

            {activePage === 'jobs' && <JobCategoryFilters categories={jobCategories} selectedCategory={jobCategory} onSelect={setJobCategory} />}

            {pageJobs.length === 0 ? <div className="empty-state">{activePage === 'saved' ? 'You have not saved any jobs yet.' : 'No roles match your search.'}</div> : <div className="job-results-grid">{pageJobs.map((job, index) => (
              <div className="job-card job-card-clickable" key={job.id} onClick={() => setJobDetail(job)}>
                <JobArtwork job={job} index={index} />
                <div>
                  <div className="job-title-row">
                    <h4>{job.title}</h4>
                    <span className="pill success">{job.status || 'OPEN'}</span>
                  </div>
                  <p className="muted-text">{job.companyName || 'Company'} · {job.location}</p>
                  <p className="job-meta">{job.employmentType} · Min experience: {job.minExperienceYears || 0}+ years</p>
                  <div className="skills-row">
                    {(job.requiredSkills || []).slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}
                  </div>
                </div>
                <button
                  className={`job-save-icon${savedJobIds.includes(job.id) ? ' saved' : ''}`}
                  type="button"
                  aria-label={savedJobIds.includes(job.id) ? 'Remove saved job' : 'Save job'}
                  title={savedJobIds.includes(job.id) ? 'Remove saved job' : 'Save job'}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSavedJobIds((current) => current.includes(job.id) ? current.filter((id) => id !== job.id) : [...current, job.id]);
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.75 4.75A1.75 1.75 0 0 1 8.5 3h7a1.75 1.75 0 0 1 1.75 1.75V21l-5.25-3.5L6.75 21V4.75Z" /></svg>
                </button>
                <div className="job-card-actions">
                  <button className="text-btn" type="button" onClick={(event) => { event.stopPropagation(); setJobDetail(job); }}>View details</button>
                  <button className={`primary${appliedJobIds.has(job.id) ? ' already-applied' : ''}`} type="button" onClick={(event) => { event.stopPropagation(); setSelectedJob(job); }} disabled={busy || appliedJobIds.has(job.id)}>{appliedJobIds.has(job.id) ? 'Already applied' : 'Apply now'}</button>
                </div>
              </div>
            ))}</div>}
          </section>

          </div>}

        {activePage === 'aiMatch' && <section className="panel ai-match-panel">
          <div className="panel-head">
            <div>
              <h3>Match your resume to a saved job</h3>
              <p>Compare resume evidence with the selected role and get practical improvement suggestions.</p>
            </div>
          </div>
          {savedJobs.length === 0 ? (
            <div className="empty-state">Save a job first to use AI Match.</div>
          ) : (
            <form className="application-form ai-match-form" onSubmit={submitMatch}>
              <label>
                Resume (PDF or TXT)
                <input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={handleMatchResumeUpload} required={!matchResumeText} />
                {matchResumeFileName && <small className="file-name">Selected: {matchResumeFileName}</small>}
              </label>
              <label>
                Choose from saved jobs
                <select value={matchJobId} onChange={(event) => { setMatchJobId(event.target.value); setMatchReport(null); setMatchReportOpen(false); }} required>
                  <option value="">Select a saved job</option>
                  {savedJobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.companyName || 'Company'}</option>)}
                </select>
              </label>
              <button className="primary" type="submit" disabled={matching || !matchResumeText || !matchJobId}>
                {matching ? 'Analyzing resume…' : 'Analyze match'}
              </button>
            </form>
          )}
          {matchReport && <div className="match-ready-card" role="status">
            <span className="match-ready-icon" aria-hidden="true">✓</span>
            <div><strong>Your match report is ready</strong><p>View the AI insights and the ATS score calculated from your resume and this job.</p></div>
            <button className="primary" type="button" onClick={() => setMatchReportOpen(true)}>View report</button>
          </div>}
        </section>}
        {matching && <div className="match-loading-overlay" role="status" aria-live="polite">
          <div className="match-loading-card">
            <div className="ai-orbit" aria-hidden="true"><span /><span /><span /><strong>AI</strong></div>
            <span className="eyebrow">HireWise intelligence</span>
            <h2>Finding your best-fit evidence</h2>
            <p>Comparing resume details with the role and preparing your match report.</p>
            <div className="loading-dots" aria-hidden="true"><i /><i /><i /></div>
          </div>
        </div>}
        {matchReportOpen && matchReport && <div className="modal-backdrop report-backdrop" onClick={() => setMatchReportOpen(false)}>
          <div className="modal match-report-modal" role="dialog" aria-modal="true" aria-labelledby="match-report-title" onClick={(event) => event.stopPropagation()}>
            <div className="panel-head">
              <div><span className="eyebrow">Resume insights</span><h3 id="match-report-title">AI match report</h3></div>
              <button className="text-btn" type="button" onClick={() => setMatchReportOpen(false)}>Close</button>
            </div>
            <div className="match-ats-score">
              <span>ATS score <small>· calculated from your resume and job keywords</small></span>
              <strong>{Number.isFinite(Number(matchReport.atsScore)) ? matchReport.atsScore : '—'}<small>/100</small></strong>
            </div>
            <div className="match-report-grid">
              <section className="match-report-group"><h4>What’s working</h4>{matchReport.matching_skills?.length ? <ul>{matchReport.matching_skills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p>No direct skill matches were identified in the available resume evidence.</p>}</section>
              <section className="match-report-group"><h4>What’s missing or unclear</h4>{matchReport.missing_or_unclear_skills?.length ? <ul>{matchReport.missing_or_unclear_skills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p>No major gaps were identified in the available excerpts.</p>}</section>
            </div>
            <section className="match-report-group match-recommendations"><h4>Suggestions</h4>{matchReport.recommendations?.length ? <ul>{matchReport.recommendations.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Highlight specific evidence for the role’s requirements where it is supported by your experience.</p>}</section>
            {matchReport.summary && <section className="detail-section"><h4>Summary</h4>{matchReport.summary.split(/\n\s*\n/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>}
            <p className="ai-disclaimer">{matchReport.notice || 'AI output can be inaccurate. Review the job description and your resume before making decisions.'}</p>
          </div>
        </div>}

        {['applications', 'selected', 'rejected'].includes(activePage) && <section className="panel candidate-applications-page" id="my-applications">
            <div className="panel-head">
              <div>
                <h3>{pageTitle}</h3>
                <p>{activePage === 'applications' ? 'View status updates and manage your submitted applications' : `Applications marked ${activePage}`}</p>
              </div>
            </div>

            {pageApplications.length === 0 ? <div className="empty-state">No {activePage === 'applications' ? 'applications' : `${activePage} applications`} to show.</div> : pageApplications.map((app) => (
              <article className="mini-card application-list-card" key={app.id} onClick={() => setSelectedApplication(app)}>
                <div className="mini-header">
                  <strong>{app.job?.title || 'Role'}</strong>
                  <span className={`status-badge ${app.status?.toLowerCase()}`}>{app.status}</span>
                </div>
                <p>{app.job?.companyName || 'Company'} · Submitted {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'recently'}</p>
                <div className="form-actions">
                  <button type="button" className="secondary-button small" onClick={() => setSelectedApplication(app)}>View application</button>
                  {app.status === 'PENDING' && <button type="button" className="danger-button small" onClick={(event) => { event.stopPropagation(); revokeApplication(app); }} disabled={busy}>Revoke application</button>}
                </div>
              </article>
            ))}
          </section>}

        {selectedApplication && (
          <div className="modal-backdrop" onClick={() => setSelectedApplication(null)}>
            <div className="modal application-detail-modal" onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <div>
                  <h3>{selectedApplication.job?.title || 'Application details'}</h3>
                  <p>{selectedApplication.job?.companyName || 'Company'} · {selectedApplication.job?.location || 'Location not provided'}</p>
                </div>
                <button className="text-btn" type="button" onClick={() => setSelectedApplication(null)}>Close</button>
              </div>
              <div className="application-detail-grid">
                <div className="detail-block"><span className="detail-label">Status</span><strong>{selectedApplication.status}</strong></div>
                <div className="detail-block"><span className="detail-label">Submitted</span><strong>{selectedApplication.createdAt ? new Date(selectedApplication.createdAt).toLocaleDateString() : 'Recently'}</strong></div>
                <div className="detail-block"><span className="detail-label">Education</span><strong>{selectedApplication.education || 'Not provided'}</strong></div>
                <div className="detail-block"><span className="detail-label">Experience</span><strong>{selectedApplication.experienceSummary || 'Not provided'}</strong></div>
              </div>
              <div className="detail-section"><h4>Skills</h4><p>{selectedApplication.skills || 'Not provided'}</p></div>
              {selectedApplication.status === 'PENDING' && <button type="button" className="danger-button" onClick={() => { setSelectedApplication(null); revokeApplication(selectedApplication); }} disabled={busy}>Revoke application</button>}
            </div>
          </div>
        )}

        {jobDetail && (
          <div className="modal-backdrop" onClick={() => setJobDetail(null)}>
            <div className="modal job-detail-modal" onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <div>
                  <h3>{jobDetail.title}</h3>
                  <p>{jobDetail.companyName || 'Company'} · {jobDetail.location}</p>
                </div>
                <button className="text-btn" type="button" onClick={() => setJobDetail(null)}>Close</button>
              </div>

              <div className="job-detail-grid">
                <div className="detail-block">
                  <span className="detail-label">Employment</span>
                  <strong>{jobDetail.employmentType || 'Full-time'}</strong>
                </div>
                <div className="detail-block">
                  <span className="detail-label">Experience</span>
                  <strong>{jobDetail.minExperienceYears || 0}+ years</strong>
                </div>
                <div className="detail-block">
                  <span className="detail-label">Department</span>
                  <strong>{jobDetail.department || 'General'}</strong>
                </div>
                <div className="detail-block">
                  <span className="detail-label">Contact</span>
                  <strong>{jobDetail.contactEmail || 'Not provided'}</strong>
                </div>
              </div>

              <div className="detail-section">
                <h4>Role description</h4>
                <p>{jobDetail.description}</p>
              </div>

              <div className="detail-section">
                <h4>Required skills</h4>
                <div className="skills-row">
                  {(jobDetail.requiredSkills || []).map((skill) => <span key={skill}>{skill}</span>)}
                </div>
              </div>

              <div className="detail-section">
                <h4>Education requirement</h4>
                <p>{jobDetail.educationRequirements || 'Bachelor\'s degree preferred'}</p>
              </div>

              <div className="modal-actions">
                <button className={`primary${appliedJobIds.has(jobDetail.id) ? ' already-applied' : ''}`} type="button" disabled={busy || appliedJobIds.has(jobDetail.id)} onClick={() => { setSelectedJob(jobDetail); setJobDetail(null); }}>{appliedJobIds.has(jobDetail.id) ? 'Already applied' : 'Apply to this role'}</button>
              </div>
            </div>
          </div>
        )}

        {profileOpen && (
          <div className="modal-backdrop" onClick={() => setProfileOpen(false)}>
            <div className="modal profile-modal" onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <div>
                  <h3>My profile</h3>
                  <p>Keep your details updated for faster applications</p>
                </div>
                <button className="text-btn" type="button" onClick={() => setProfileOpen(false)}>Close</button>
              </div>

              <form onSubmit={saveProfile} className="profile-form">
                <div className="two-col">
                  <label>
                    Full name
                    <input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} />
                  </label>
                  <label>
                    Email
                    <input type="email" value={profileForm.email} onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })} />
                  </label>
                </div>

                <div className="two-col">
                  <label>
                    Phone
                    <input value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} />
                  </label>
                  <label>
                    Education
                    <input value={profileForm.education} onChange={(event) => setProfileForm({ ...profileForm, education: event.target.value })} />
                  </label>
                </div>

                <label>
                  Skills
                  <input value={profileForm.skills} onChange={(event) => setProfileForm({ ...profileForm, skills: event.target.value })} />
                </label>

                <label>
                  Professional summary
                  <textarea rows="5" maxLength={2000} value={profileForm.summary} onChange={(event) => setProfileForm({ ...profileForm, summary: event.target.value })} placeholder="A short overview of your experience, strengths, and career goals" />
                </label>

                <div className="modal-actions">
                  <button className="secondary-button" type="button" onClick={() => setProfileOpen(false)}>Cancel</button>
                  <button className="primary" type="submit">Save profile</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedJob && (
          <div className="modal-backdrop" onClick={() => setSelectedJob(null)}>
            <div className="modal application-modal" onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <div>
                  <h3>Apply for {selectedJob.title}</h3>
                  <p>{selectedJob.companyName || 'Company'} · {selectedJob.location}</p>
                </div>
                <button className="text-btn" onClick={() => setSelectedJob(null)}>Close</button>
              </div>

              <form onSubmit={submitApplication} className="application-form">
                <div className="two-col">
                  <label>
                    Phone
                    <input maxLength={255} value={applicationForm.phone} onChange={(event) => setApplicationForm({ ...applicationForm, phone: event.target.value })} />
                  </label>
                  <label>
                    Education
                    <input maxLength={255} value={applicationForm.education} onChange={(event) => setApplicationForm({ ...applicationForm, education: event.target.value })} />
                  </label>
                </div>

                <label>
                  Skills
                  <input maxLength={255} value={applicationForm.skills} onChange={(event) => setApplicationForm({ ...applicationForm, skills: event.target.value })} />
                </label>

                <label>
                  Experience summary
                  <textarea rows="4" maxLength={255} value={applicationForm.experienceSummary} onChange={(event) => setApplicationForm({ ...applicationForm, experienceSummary: event.target.value })} />
                </label>

                <label>
                  Upload resume (PDF or TXT)
                  <input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={handleFileUpload} required={!((applicationForm.resumeText || session.user.resumeText || '').trim())} />
                  {applicationForm.resumeFileName && <small className="file-name">Selected: {applicationForm.resumeFileName}</small>}
                  {!applicationForm.resumeFileName && session.user.resumeText && <small className="file-name">Using saved profile resume</small>}
                </label>

                <button className="primary" disabled={busy || appliedJobIds.has(selectedJob.id)}>Submit application</button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function RecruiterDashboard({ session, jobs, applications, setRecruiterApplications, busy, notice, setNotice, setSession, action, loadRecruiterJobs, loadRecruiterApplications }) {
  const [editingJobId, setEditingJobId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: session.user.fullName || '',
    companyName: session.user.companyName || '',
    email: session.user.email || '',
    phone: session.user.phone || '',
  });
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [candidateReport, setCandidateReport] = useState(null);
  const [candidateReportOpen, setCandidateReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [activePage, setActivePage] = useState('home');
  const [chartPeriod, setChartPeriod] = useState('week');
  const [candidateStatusView, setCandidateStatusView] = useState('SELECTED');
  const [recalculatingAts, setRecalculatingAts] = useState(false);
  const [atsScoreUpdated, setAtsScoreUpdated] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [jobCategory, setJobCategory] = useState('all');
  const [jobForm, setJobForm] = useState({
    title: '',
    companyName: session.user.companyName || '',
    department: 'Engineering',
    location: 'Remote',
    employmentType: 'Full-time',
    minExperienceYears: 3,
    requiredSkills: 'Java, Spring Boot, SQL',
    educationRequirements: 'Bachelor\'s degree or equivalent',
    contactEmail: session.user.email || '',
    contactPhone: session.user.phone || '',
    description: 'Build and scale backend systems with Java and modern cloud tools.',
    status: 'OPEN',
  });

  async function submitJob(event) {
    event.preventDefault();
    await action(async () => {
      const payload = {
        ...jobForm,
        requiredSkills: jobForm.requiredSkills.split(',').map((item) => item.trim()).filter(Boolean),
      };
      await request(editingJobId ? `/jobs/${editingJobId}` : '/jobs', {
        method: editingJobId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      const wasEditing = Boolean(editingJobId);
      setEditingJobId(null);
      setJobForm({
        title: '',
        companyName: session.user.companyName || '',
        department: 'Engineering',
        location: 'Remote',
        employmentType: 'Full-time',
        minExperienceYears: 3,
        requiredSkills: 'Java, Spring Boot, SQL',
        educationRequirements: 'Bachelor\'s degree or equivalent',
        contactEmail: session.user.email || '',
        contactPhone: session.user.phone || '',
        description: 'Build and scale backend systems with Java and modern cloud tools.',
        status: 'OPEN',
      });
      await loadRecruiterJobs();
      await loadRecruiterApplications();
      setActivePage('jobs');
      setNotice(wasEditing ? 'Job updated successfully.' : 'Job created successfully.');
    });
  }

  function editJob(job) {
    setEditingJobId(job.id);
    setActivePage('create');
    setJobForm({
      title: job.title || '',
      companyName: job.companyName || '',
      department: job.department || '',
      location: job.location || '',
      employmentType: job.employmentType || '',
      minExperienceYears: job.minExperienceYears || 0,
      requiredSkills: (job.requiredSkills || []).join(', '),
      educationRequirements: job.educationRequirements || '',
      contactEmail: job.contactEmail || '',
      contactPhone: job.contactPhone || '',
      description: job.description || '',
      status: job.status || 'OPEN',
    });
    document.getElementById('job-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function deleteJob(job) {
    if (!window.confirm(`Delete "${job.title}"?`)) return;
    await action(async () => {
      await request(`/jobs/${job.id}`, { method: 'DELETE' });
      if (editingJobId === job.id) setEditingJobId(null);
      await loadRecruiterJobs();
      setNotice('Job deleted.');
    });
  }

  function cancelJobEdit() {
    setEditingJobId(null);
    setJobForm({
      title: '',
      companyName: session.user.companyName || '',
      department: 'Engineering',
      location: 'Remote',
      employmentType: 'Full-time',
      minExperienceYears: 3,
      requiredSkills: 'Java, Spring Boot, SQL',
      educationRequirements: 'Bachelor\'s degree or equivalent',
      contactEmail: session.user.email || '',
      contactPhone: session.user.phone || '',
      description: 'Build and scale backend systems with Java and modern cloud tools.',
      status: 'OPEN',
    });
  }

  const filteredJobs = jobs.filter((job) => [job.title, job.companyName, job.location, ...(job.requiredSkills || [])]
    .join(' ').toLowerCase().includes(searchTerm.trim().toLowerCase())
    && (jobCategory === 'all' || (job.department || 'Technology') === jobCategory));
  const jobCategories = [...new Set(jobs.map((job) => job.department || 'Technology'))].sort();
  const recruiterStats = [
    { label: 'Open roles', value: jobs.filter((job) => job.status === 'OPEN').length },
    { label: 'Applications', value: applications.length },
    { label: 'Awaiting review', value: applications.filter((application) => !application.status || application.status === 'PENDING').length },
  ];

  const selectedCandidateSummary = selectedApplication && [
    selectedApplication.experienceSummary,
    selectedApplication.skills && `Skills: ${selectedApplication.skills}`,
    selectedApplication.education && `Education: ${selectedApplication.education}`,
  ].filter(Boolean).join(' ');
  const pageApplications = applications.filter((application) => (
    activePage === 'decisions' ? application.status === candidateStatusView : true
  ));
  const pageTitle = {
    home: session.user.companyName || 'Hiring team',
    applications: 'All applications',
    decisions: 'Candidate decisions',
    jobs: 'My job posts',
    create: editingJobId ? 'Edit job post' : 'Create a job',
  }[activePage];

  async function recalculateAts(applicationId) {
    setRecalculatingAts(true);
    setAtsScoreUpdated(false);
    try {
      const updated = await request(`/applications/${applicationId}/ats/recalculate`, { method: 'POST' });
      setRecruiterApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedApplication(updated);
      setAtsScoreUpdated(true);
      setNotice('ATS score recalculated.');
    } catch (error) {
      setNotice(error.message || 'Unable to recalculate ATS score.');
    } finally {
      setRecalculatingAts(false);
    }
  }

  async function analyzeCandidate(applicationId) {
    setReportLoading(true);
    try {
      const report = await request(`/applications/${applicationId}/candidate-report`, { method: 'POST' });
      setCandidateReport(report);
      setCandidateReportOpen(true);
    } catch (error) {
      setNotice(error.message || 'Unable to generate the candidate report.');
    } finally {
      setReportLoading(false);
    }
  }

  async function openCandidate(application) {
    setSelectedApplication(application);
    setCandidateReport(null);
    setCandidateReportOpen(false);
    setRecalculatingAts(true);
    setReportLoading(true);
    setAtsScoreUpdated(false);
    const results = await Promise.allSettled([
      request(`/applications/${application.id}/ats/recalculate`, { method: 'POST' }),
      request(`/applications/${application.id}/candidate-report`, { method: 'POST' }),
    ]);
    const [atsResult, reportResult] = results;
    if (atsResult.status === 'fulfilled') {
      const updated = atsResult.value;
      setRecruiterApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedApplication((current) => current?.id === updated.id ? updated : current);
      setAtsScoreUpdated(true);
    } else {
      setNotice(atsResult.reason?.message || 'Unable to calculate the ATS score.');
    }
    if (reportResult.status === 'fulfilled') {
      setCandidateReport(reportResult.value);
    } else {
      setNotice(reportResult.reason?.message || 'Unable to generate the candidate report.');
    }
    setRecalculatingAts(false);
    setReportLoading(false);
  }

  async function saveRecruiterProfile(event) {
    event.preventDefault();
    await action(async () => {
      const updatedUser = await request(`/recruiters/${session.user.id}/profile`, {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      });
      setSession((current) => current ? { ...current, user: { ...current.user, ...updatedUser } } : current);
      setProfileForm({
        fullName: updatedUser.fullName || '',
        companyName: updatedUser.companyName || '',
        email: updatedUser.email || '',
        phone: updatedUser.phone || '',
      });
      setJobForm((current) => ({
        ...current,
        companyName: updatedUser.companyName || '',
        contactEmail: updatedUser.email || '',
        contactPhone: updatedUser.phone || '',
      }));
      await loadRecruiterJobs();
      setProfileOpen(false);
      setNotice('Recruiter profile updated successfully.');
    });
  }

  function navigateTo(page) {
    setActivePage(page);
    if (page === 'create') setEditingJobId(null);
  }

  async function updateStatus(applicationId, status) {
    await action(async () => {
      await request(`/applications/${applicationId}/status?status=${status}`, { method: 'PUT' });
      await loadRecruiterApplications();
      setSelectedApplication((current) => current?.id === applicationId ? { ...current, status } : current);
      setNotice(`Application marked as ${status}.`);
    });
  }

  return (
    <div className="app-shell recruiter-app">
      <header className="top-nav">
        <div className="brand-block">
          <div className="brand-icon">T</div>
          <div className="brand-name">TalentSelect</div>
        </div>
        <nav className="top-nav-links">
          <button type="button" className={activePage === 'home' ? 'active' : ''} onClick={() => navigateTo('home')}>Home</button>
          <button type="button" className={activePage === 'applications' ? 'active' : ''} onClick={() => navigateTo('applications')}>Applications</button>
          <button type="button" className={activePage === 'jobs' ? 'active' : ''} onClick={() => navigateTo('jobs')}>Jobs</button>
          <button type="button" className={activePage === 'create' ? 'active' : ''} onClick={() => navigateTo('create')}>Create</button>
          <button type="button" className={activePage === 'decisions' ? 'active' : ''} onClick={() => navigateTo('decisions')}>Decisions</button>
        </nav>
        <div className="nav-account">
          <button type="button" className="profile-button" onClick={() => setProfileOpen(true)}>
            <span className="avatar">{(session.user.fullName || session.user.username || 'R').slice(0, 1).toUpperCase()}</span>
            <span>Profile</span>
          </button>
          <button className="nav-logout" onClick={() => setSession(null)}>Logout</button>
        </div>
      </header>

      <main className="main-panel">
        <header className="page-header">
          <div>
            <div className="eyebrow">{activePage === 'home' ? 'Recruiter dashboard' : 'TalentSelect workspace'}</div>
            <h1>{pageTitle}</h1>
          </div>
        </header>

        {notice && <div className="toast" role="status">{notice}</div>}

        {activePage === 'home' && <section className="workspace-hero recruiter-hero">
          <img src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=2000&q=90" alt="A modern office ready for a growing technology team" />
          <div className="workspace-hero-content">
            <span className="hero-kicker"><span className="hero-sparkle" aria-hidden="true">✦</span> YOUR NEXT GREAT HIRE</span>
            <h2>Build a team that shapes the future.</h2>
            <p>Meet standout talent and make every hiring decision with confidence.</p>
            <button className="primary" type="button" onClick={() => navigateTo('create')}>Create a job post <span aria-hidden="true">→</span></button>
          </div>
          <div className="hero-image-caption"><span className="hero-caption-icon">✦</span> Better teams start with great matches</div>
        </section>}

        {activePage === 'home' && <section className="stats-grid recruiter-stats" aria-label="Hiring overview">
          {recruiterStats.map((stat) => (
            <div className="stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </section>}

        {activePage === 'home' && <>
        <div className="analytics-grid">
          <WeeklyApplicationsChart applications={applications} period={chartPeriod} setPeriod={setChartPeriod} />
          <ApplicationStatusChart applications={applications} period={chartPeriod} />
        </div>
        <section className="panel latest-applications-panel">
          <div className="panel-head">
            <div>
              <h3>Latest applications</h3>
              <p>Your most recent candidate activity</p>
            </div>
            <button type="button" className="text-btn" onClick={() => navigateTo('applications')}>View all</button>
          </div>
          {applications.length === 0 ? <div className="empty-state">New applications will appear here.</div> : (
            <div className="latest-application-grid">
              {[...applications].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5).map((application) => (
                <button type="button" className="latest-application-card recruiter-latest-card" key={application.id} onClick={() => openCandidate(application)}>
                  <span className={`latest-status-icon ${application.status?.toLowerCase() || 'pending'}`}>{application.status === 'SELECTED' ? '✓' : application.status === 'REJECTED' ? '×' : '◷'}</span>
                  <span className="latest-applicant-info">
                    <strong>{application.candidate?.name || 'Candidate'}</strong>
                    <small>{application.job?.title || 'Role'} · {application.createdAt ? new Date(application.createdAt).toLocaleDateString() : 'Recently'}</small>
                  </span>
                  <span className={`status-badge ${application.status?.toLowerCase()}`}>{application.status}</span>
                </button>
              ))}
            </div>
          )}
        </section>
        </>}

        {activePage === 'create' && <div className="content-grid recruiter-grid">
          <section className="panel" id="job-editor">
            <div className="panel-head">
              <div>
                <h3>{editingJobId ? 'Edit job post' : 'Create a job'}</h3>
                <p>{editingJobId ? 'Update the details for this role' : 'Set hiring requirements and application criteria'}</p>
              </div>
            </div>

            <form onSubmit={submitJob} className="job-form">
              <div className="two-col">
                <label>
                  Job title
                  <input value={jobForm.title} onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })} />
                </label>
                <label>
                  Company
                  <input value={jobForm.companyName} onChange={(event) => setJobForm({ ...jobForm, companyName: event.target.value })} />
                </label>
              </div>

              <div className="two-col">
                <label>
                  Department
                  <input value={jobForm.department} onChange={(event) => setJobForm({ ...jobForm, department: event.target.value })} />
                </label>
                <label>
                  Location
                  <input value={jobForm.location} onChange={(event) => setJobForm({ ...jobForm, location: event.target.value })} />
                </label>
              </div>

              <div className="two-col">
                <label>
                  Employment type
                  <input value={jobForm.employmentType} onChange={(event) => setJobForm({ ...jobForm, employmentType: event.target.value })} />
                </label>
                <label>
                  Min experience (years)
                  <input type="number" min="0" value={jobForm.minExperienceYears} onChange={(event) => setJobForm({ ...jobForm, minExperienceYears: Number(event.target.value) })} />
                </label>
              </div>

              <label>
                Required skills
                <input value={jobForm.requiredSkills} onChange={(event) => setJobForm({ ...jobForm, requiredSkills: event.target.value })} />
              </label>

              <label>
                Education requirement
                <input value={jobForm.educationRequirements} onChange={(event) => setJobForm({ ...jobForm, educationRequirements: event.target.value })} />
              </label>

              <label>
                Contact email
                <input type="email" value={jobForm.contactEmail} onChange={(event) => setJobForm({ ...jobForm, contactEmail: event.target.value })} />
              </label>

              <label>
                Contact phone
                <input value={jobForm.contactPhone} onChange={(event) => setJobForm({ ...jobForm, contactPhone: event.target.value })} />
              </label>

              <label>
                Job description
                <textarea rows="5" value={jobForm.description} onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })} />
              </label>

              <div className="form-actions">
                <button className="primary" type="submit" disabled={busy}>{editingJobId ? 'Save changes' : 'Publish job'}</button>
                {editingJobId && <button className="secondary-button" type="button" onClick={cancelJobEdit}>Cancel edit</button>}
              </div>
            </form>
          </section>
        </div>}

        {activePage === 'jobs' && <section className="panel recruiter-jobs-panel" id="my-jobs">
          <div className="panel-head">
            <div><h3>All created jobs</h3><p>Manage and update the roles published by your team</p></div>
            <button className="primary" type="button" onClick={() => navigateTo('create')}>Create a job</button>
          </div>
          <div className="search-controls recruiter-job-search">
            <input type="search" aria-label="Search created jobs" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search your jobs" />
          </div>
          <JobCategoryFilters categories={jobCategories} selectedCategory={jobCategory} onSelect={setJobCategory} />
          {filteredJobs.length === 0 ? <div className="empty-state">No created jobs match your search.</div> : <div className="job-results-grid recruiter-job-results">{filteredJobs.map((job, index) => (
            <div className="job-card recruiter-job-card" key={job.id}>
              <JobArtwork job={job} index={index} />
              <div className="job-title-row"><h4>{job.title}</h4><span className="pill success">{job.status || 'OPEN'}</span></div>
              <p className="muted-text">{job.companyName} · {job.location}</p>
              <div className="skills-row">{(job.requiredSkills || []).map((skill) => <span key={skill}>{skill}</span>)}</div>
              <p className="job-description">{job.description}</p>
              <div className="form-actions job-management-actions">
                <button className="secondary-button small" type="button" onClick={() => editJob(job)}>Edit</button>
                <button className="danger-button small" type="button" onClick={() => deleteJob(job)} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}</div>}
        </section>}

        {['applications', 'decisions'].includes(activePage) && <section className="panel applications-panel" id="my-applications">
          <div className="panel-head">
            <div>
              <h3>{pageTitle}</h3>
              <p>{activePage === 'applications' ? 'Review, screen, and shortlist applicants' : `${pageApplications.length} ${candidateStatusView.toLowerCase()} candidates`}</p>
            </div>
          </div>
          {activePage === 'decisions' && <div className="candidate-status-toggle" role="tablist" aria-label="Candidate decision status">
            <button type="button" role="tab" aria-selected={candidateStatusView === 'SELECTED'} className={candidateStatusView === 'SELECTED' ? 'active' : ''} onClick={() => setCandidateStatusView('SELECTED')}>Selected <span>{applications.filter((item) => item.status === 'SELECTED').length}</span></button>
            <button type="button" role="tab" aria-selected={candidateStatusView === 'REJECTED'} className={candidateStatusView === 'REJECTED' ? 'active' : ''} onClick={() => setCandidateStatusView('REJECTED')}>Rejected <span>{applications.filter((item) => item.status === 'REJECTED').length}</span></button>
          </div>}

          {pageApplications.length === 0 ? <div className="empty-state">No applications in this view yet.</div> : pageApplications.map((application) => (
            <button type="button" className="application-card clickable-application-card compact-application-card" key={application.id} onClick={() => openCandidate(application)}>
              <span className="compact-applicant-avatar">{(application.candidate?.name || 'C').slice(0, 1).toUpperCase()}</span>
              <span className="compact-applicant-info">
                <strong>{application.candidate?.name || 'Candidate'}</strong>
                <small>{application.job?.title || 'Role'} · {application.candidate?.email || 'No email'}</small>
              </span>
              <span className="compact-ats-score"><strong>{application.atsScore ?? 0}</strong><small>ATS</small></span>
              <span className={`status-badge ${application.status?.toLowerCase()}`}>{application.status}</span>
              <span className="compact-card-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </section>}
        {selectedApplication && (
          <div className="modal-backdrop" onClick={() => setSelectedApplication(null)}>
            <div className="modal recruiter-application-modal" onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Candidate application</span>
                  <h3>{selectedApplication.candidate?.name || 'Candidate'}</h3>
                  <p>{selectedApplication.job?.title || 'Role'} · {selectedApplication.job?.companyName || 'Company'}</p>
                </div>
                <button className="text-btn" type="button" onClick={() => setSelectedApplication(null)}>Close</button>
              </div>
              {(recalculatingAts || reportLoading) && <div className="candidate-analysis-loading" role="status" aria-live="polite">
                <span className="analysis-spinner" aria-hidden="true" />
                <span><strong>Analyzing resume against this role</strong><small>Calculating the ATS score and preparing evidence-based insights…</small></span>
              </div>}
              <div className="candidate-detail-grid">
                <div className="detail-block"><span className="detail-label">Email</span><strong>{selectedApplication.candidate?.email || 'Not provided'}</strong></div>
                <div className="detail-block"><span className="detail-label">Phone</span><strong>{selectedApplication.phone || selectedApplication.candidate?.phone || 'Not provided'}</strong></div>
                <div className="detail-block"><span className="detail-label">Education</span><strong>{selectedApplication.education || 'Not provided'}</strong></div>
                <div className="detail-block"><span className="detail-label">Experience</span><strong>{selectedApplication.experienceSummary || 'Not provided'}</strong></div>
              </div>
              <div className="detail-section candidate-summary-box">
                <h4>Candidate summary</h4>
                <p>{selectedCandidateSummary || selectedApplication.aiSummary || 'No candidate summary is available yet.'}</p>
              </div>
              <div className="candidate-skills-box">
                <strong>Skills</strong>
                <p>{selectedApplication.skills || 'Not provided'}</p>
              </div>
              <div className="candidate-resume-box">
                <strong>Resume</strong>
                <pre>{selectedApplication.resumeText || 'No resume text provided.'}</pre>
              </div>
              <div className="application-modal-footer">
                {recalculatingAts ? (
                  <div className="ats-analysis" role="status" aria-live="polite">
                    <span className="analysis-spinner" aria-hidden="true" />
                    <span><strong>Analyzing resume…</strong><small>Comparing skills and experience with the role</small></span>
                    <span className="analysis-progress"><i /></span>
                  </div>
                ) : (
                  <>
                    <div className="ats-score-large">
                      <span>ATS score</span>
                      <AnimatedAtsScore value={selectedApplication.atsScore} animate={atsScoreUpdated} />
                    </div>
                    <button className="secondary-button" type="button" onClick={() => candidateReport ? setCandidateReportOpen(true) : analyzeCandidate(selectedApplication.id)} disabled={reportLoading}>
                      {reportLoading ? 'Analyzing resume…' : candidateReport ? 'View AI report' : 'Analyze resume'}
                    </button>
                    <button className="primary" type="button" onClick={() => recalculateAts(selectedApplication.id)}>Recalculate ATS score</button>
                  </>
                )}
              </div>
              <div className={`detail-section ats-summary-result ${atsScoreUpdated ? 'summary-revealed' : ''}`}>
                <h4>Analysis summary</h4>
                <p>{selectedApplication.aiSummary || selectedCandidateSummary || 'No summary available for this application.'}</p>
              </div>
              <div className="application-review-actions">
                <span className={`status-badge ${selectedApplication.status?.toLowerCase()}`}>{selectedApplication.status}</span>
                <button className="primary small" type="button" disabled={busy} onClick={() => updateStatus(selectedApplication.id, 'SELECTED')}>Select candidate</button>
                <button className="secondary-button small" type="button" disabled={busy} onClick={() => updateStatus(selectedApplication.id, 'REJECTED')}>Reject candidate</button>
              </div>
            </div>
          </div>
        )}
        {candidateReportOpen && candidateReport && (
          <div className="modal-backdrop report-backdrop" onClick={() => setCandidateReportOpen(false)}>
            <div className="modal candidate-report-modal" role="dialog" aria-modal="true" aria-labelledby="candidate-report-title" onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Resume analysis</span>
                  <h3 id="candidate-report-title">Candidate Report</h3>
                </div>
                <button className="text-btn" type="button" onClick={() => setCandidateReportOpen(false)}>Close</button>
              </div>
              <div className="candidate-report-skills">
                <section className="report-skill-group matched"><h4>Matched skills</h4>{candidateReport.matchedSkills?.length ? <ul>{candidateReport.matchedSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p>No matched skills were identified.</p>}</section>
                <section className="report-skill-group missing"><h4>Missing / unclear</h4>{candidateReport.missingSkills?.length ? <ul>{candidateReport.missingSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p>No major gaps were identified.</p>}</section>
                <section className="report-skill-group extra"><h4>Additional skills</h4>{candidateReport.extraSkills?.length ? <ul>{candidateReport.extraSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p>No additional skills were identified.</p>}</section>
              </div>
              <section className="detail-section candidate-report-summary">
                <h4>AI-generated summary</h4>
                {(candidateReport.summary || 'No summary was returned.').split(/\n\s*\n/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </section>
              <p className="ai-disclaimer">{candidateReport.notice}</p>
            </div>
          </div>
        )}
        {profileOpen && (
          <div className="modal-backdrop" onClick={() => setProfileOpen(false)}>
            <div className="modal profile-modal" onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <div><h3>Edit recruiter profile</h3><p>Changes update your dashboard and published job details</p></div>
                <button className="text-btn" type="button" onClick={() => setProfileOpen(false)}>Close</button>
              </div>
              <form className="profile-form" onSubmit={saveRecruiterProfile}>
                <label>Full name<input required maxLength={255} value={profileForm.fullName} onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })} /></label>
                <label>Company name<input required maxLength={255} value={profileForm.companyName} onChange={(event) => setProfileForm({ ...profileForm, companyName: event.target.value })} /></label>
                <label>Email<input type="email" maxLength={255} value={profileForm.email} onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })} /></label>
                <label>Phone<input maxLength={255} value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} /></label>
                <div className="modal-actions">
                  <button className="secondary-button" type="button" onClick={() => setProfileOpen(false)}>Cancel</button>
                  <button className="primary" type="submit" disabled={busy}>Save profile</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export { request };
