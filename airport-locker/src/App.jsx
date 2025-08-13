import React, { useState, useMemo, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'; // Make API calls to the same server that serves the app

// --- Helper Functions ---
const formatDuration = (isoString) => {
    if (!isoString) return '';
    const now = new Date();
    const then = new Date(isoString);
    const diffSeconds = Math.round((now - then) / 1000);
    const days = Math.floor(diffSeconds / 86400);
    const hours = Math.floor((diffSeconds % 86400) / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ago`;
    if (hours > 0) return `${hours}h ${minutes}m ago`;
    if (minutes < 1) return 'Just now';
    return `${minutes}m ago`;
};

const calculateFee = (checkInTime) => {
    if (!checkInTime) return { duration: 'N/A', fee: 0 };
    const now = new Date();
    const then = new Date(checkInTime);
    const diffHours = (now - then) / (1000 * 60 * 60);
    let fee;
    if (diffHours <= 1) fee = 100;
    else if (diffHours <= 3) fee = 200;
    else if (diffHours <= 6) fee = 300;
    else fee = 500;
    const diffMinutes = Math.round((now - then) / (1000 * 60));
    const days = Math.floor(diffMinutes / 1440);
    const hours = Math.floor((diffMinutes % 1440) / 60);
    const minutes = diffMinutes % 60;
    let durationString = '';
    if (days > 0) durationString += `${days}d `;
    if (hours > 0) durationString += `${hours}h `;
    durationString += `${minutes}m`;
    return { duration: durationString.trim(), fee };
};

// --- SVG Icons ---
const LuggageIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 20h0a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h0" /><path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14" /><path d="M10 6h4" /><path d="M8 2h8" /></svg>);
const SearchIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={className} viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/></svg>);
const CheckCircleIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" className={className} viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>);
const XCircleIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" className={className} viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/></svg>);


// --- Main Components ---
const Modal = ({ show, onClose, title, message, isError }) => {
  if (!show) return null;
  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center p-4">
              {isError ? <XCircleIcon className="text-danger mb-3" /> : <CheckCircleIcon className="text-success mb-3" />}
              <h3 className="modal-title fs-4 fw-bold mb-2">{title}</h3>
              <p className="text-muted fs-6">{message}</p>
              <button onClick={onClose} className={`btn ${isError ? 'btn-danger' : 'btn-primary'} w-100 mt-3`}>
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const ReceiptModal = ({ show, onClose, onConfirm, receipt }) => {
    if (!show || !receipt) return null;
    return (
        <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show d-block" tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header border-bottom-0">
                            <h5 className="modal-title fw-bold">Checkout Receipt</h5>
                            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
                        </div>
                        <div className="modal-body pt-0">
                            <div className="text-center mb-4">
                               <p className="fs-1 fw-bolder mb-0">₹{receipt.fee}</p>
                               <p className="text-muted">Total Amount Due</p>
                            </div>
                            <ul className="list-group list-group-flush">
                                <li className="list-group-item d-flex justify-content-between px-0">
                                    <span className="text-muted">Locker Number</span>
                                    <span className="fw-semibold">{receipt.lockerNumber}</span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between px-0">
                                    <span className="text-muted">Storage Duration</span>
                                    <span className="fw-semibold">{receipt.duration}</span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between px-0">
                                    <span className="text-muted">Check-in Time</span>
                                    <span className="fw-semibold">{new Date(receipt.checkInTime).toLocaleString()}</span>
                                </li>
                                 <li className="list-group-item d-flex justify-content-between px-0">
                                    <span className="text-muted">Check-out Time</span>
                                    <span className="fw-semibold">{new Date().toLocaleString()}</span>
                                </li>
                            </ul>
                        </div>
                        <div className="modal-footer flex-column border-top-0">
                            <button type="button" className="btn btn-primary w-100" onClick={() => onConfirm(receipt.lockerId)}>
                                Confirm Payment & Free Locker
                            </button>
                            <button type="button" className="btn btn-link text-muted w-100" onClick={onClose}>Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const LockerCard = ({ locker, onCheckout }) => {
  const isOccupied = locker.status === 'Occupied';
  const borderClass = isOccupied ? 'border-danger' : 'border-success';
  const statusBadgeClass = isOccupied ? 'bg-danger-subtle text-danger-emphasis' : 'bg-success-subtle text-success-emphasis';
  return (
    <div className={`card shadow-sm h-100 border-start-0 border-end-0 border-bottom-0 ${borderClass}`} style={{borderWidth: '4px'}}>
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="card-title fw-bold mb-0">{locker.number}</h5>
          <span className={`badge rounded-pill ${statusBadgeClass}`}>{locker.status}</span>
        </div>
        <p className="card-text text-muted mt-2 mb-1">Type: {locker.type}</p>
        <div className="mt-auto pt-2">
            {isOccupied ? (
                <>
                    <p className="card-text text-muted small mb-2">
                        Stored: {formatDuration(locker.checkInTime)}
                    </p>
                    <button className="btn btn-sm btn-outline-danger w-100" onClick={() => onCheckout(locker.id)}>
                        Check-out
                    </button>
                </>
            ) : (
                <p className="card-text text-muted small">&nbsp;</p>
            )}
        </div>
      </div>
    </div>
  );
};

const CheckinView = ({ onCheckin }) => {
  const luggageTypes = ['Small', 'Medium', 'Large', 'VIP'];
  return (
    <div className="container d-flex flex-column align-items-center justify-content-center" style={{minHeight: '80vh'}}>
      <div className="text-center">
        <LuggageIcon className="text-primary" style={{width: '64px', height: '64px'}} />
        <h1 className="display-5 fw-bold text-dark mt-3">Luggage Check-in</h1>
        <p className="lead text-muted">Select the luggage size to assign a locker.</p>
      </div>
      <div className="row g-4 mt-4 w-100" style={{maxWidth: '900px'}}>
        {luggageTypes.map(type => (
          <div key={type} className="col-lg-3 col-md-6">
            <button
              onClick={() => onCheckin(type)}
              className="btn btn-light w-100 p-4 shadow-sm border"
            >
              <span className="d-block fs-4 fw-semibold text-dark">{type}</span>
              <span className="d-block text-muted">Locker</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReceiptsPanel = ({ receipts }) => {
    return (
        <div className="card shadow-sm">
            <div className="card-header bg-white">
                <h5 className="mb-0 fw-bold">Recent Transactions</h5>
            </div>
            <div className="card-body p-0" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                {receipts && receipts.length > 0 ? (
                    <ul className="list-group list-group-flush">
                        {receipts.map(receipt => (
                            <li key={receipt.id} className="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <p className="fw-bold mb-0">Locker {receipt.locker_number}</p>
                                    <p className="text-muted small mb-0">{formatDuration(receipt.check_out_time)}</p>
                                </div>
                                <span className="badge bg-primary-subtle text-primary-emphasis rounded-pill fs-6 fw-semibold">
                                    ₹{receipt.fee_charged}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center p-5 text-muted">
                        No recent transactions found.
                    </div>
                )}
            </div>
        </div>
    );
};

const DashboardView = ({ stats, lockers, receipts, onFilterChange, onSearchChange, filterType, searchTerm, onCheckout }) => {
  const filterTypes = ['All', 'Occupied', 'Small', 'Medium', 'Large', 'VIP'];
  return (
    <div className="container-fluid p-4">
        <h1 className="h3 fw-bold text-dark mb-4">Lockers Dashboard</h1>
        <div className="row g-4">
            <div className="col-lg-4 col-xl-3">
                <ReceiptsPanel receipts={receipts} />
            </div>
            <div className="col-lg-8 col-xl-9">
                <div className="row g-3">
                    <div className="col-md-4"><div className="card p-3 bg-primary-subtle border-0 shadow-sm"><p className="text-primary-emphasis fw-semibold mb-1">Total Lockers</p><p className="h2 fw-bold text-primary-emphasis mb-0">{stats.total}</p></div></div>
                    <div className="col-md-4"><div className="card p-3 bg-danger-subtle border-0 shadow-sm"><p className="text-danger-emphasis fw-semibold mb-1">Occupied Lockers</p><p className="h2 fw-bold text-danger-emphasis mb-0">{stats.occupied}</p></div></div>
                    <div className="col-md-4"><div className="card p-3 bg-success-subtle border-0 shadow-sm"><p className="text-success-emphasis fw-semibold mb-1">Free Lockers</p><p className="h2 fw-bold text-success-emphasis mb-0">{stats.free}</p></div></div>
                </div>
                <div className="card mt-4 shadow-sm">
                    <div className="card-body">
                        <div className="row g-2 align-items-center">
                            <div className="col-lg-auto">
                                <div className="btn-group" role="group">
                                    {filterTypes.map(type => (
                                        <button key={type} type="button" onClick={() => onFilterChange(type)} className={`btn ${filterType === type ? 'btn-primary' : 'btn-outline-secondary'}`}>
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="col-lg">
                                <div className="input-group">
                                    <span className="input-group-text"><SearchIcon /></span>
                                    <input type="text" className="form-control" placeholder="Search by Locker Number (e.g., L-101)" value={searchTerm} onChange={onSearchChange}/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="row g-3 mt-1">
                    {lockers.length > 0 ? (
                        lockers.map(locker => (
                            <div key={locker.id} className="col-sm-6 col-md-4 col-lg-4 col-xl-3">
                                <LockerCard locker={locker} onCheckout={onCheckout} />
                            </div>
                        ))
                    ) : (
                        <div className="col-12">
                            <p className="text-center text-muted mt-5">No lockers match your criteria.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};


export default function App() {
  const [view, setView] = useState('dashboard');
  const [lockers, setLockers] = useState([]);
  const [stats, setStats] = useState({ total: 0, occupied: 0, free: 0 });
  const [filterType, setFilterType] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalInfo, setModalInfo] = useState({ show: false, title: '', message: '', isError: false });
  const [isLoading, setIsLoading] = useState(true);
  const [receiptInfo, setReceiptInfo] = useState({ show: false, details: null });
  const [receipts, setReceipts] = useState([]);

  const fetchDashboardData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/dashboard`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setLockers(data.lockers);
      setStats(data.stats);
      setReceipts(data.receipts);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setModalInfo({ show: true, title: 'Network Error', message: 'Could not connect to the server.', isError: true });
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(true);
    const interval = setInterval(() => {
        setLockers(currentLockers => [...currentLockers]); 
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleCheckin = async (luggageType) => {
    try {
      const response = await fetch(`${API_URL}/api/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ luggageType }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Check-in failed');
      }
      
      // Fetch data immediately after a successful check-in
      fetchDashboardData();
      
      setModalInfo({
        show: true,
        title: 'Success!',
        message: `Please assign luggage to Locker ${data.assigned_locker}.`,
        isError: false,
      });
    } catch (error) {
      setModalInfo({
        show: true,
        title: 'Error!',
        message: error.message,
        isError: true,
      });
    }
  };

  const initiateCheckout = (lockerId) => {
    const lockerToCheckout = lockers.find(l => l.id === lockerId);
    if (!lockerToCheckout) return;
    const { duration, fee } = calculateFee(lockerToCheckout.checkInTime);
    setReceiptInfo({
        show: true,
        details: { lockerId, lockerNumber: lockerToCheckout.number, checkInTime: lockerToCheckout.checkInTime, duration, fee }
    });
  };

  const handleConfirmCheckout = async (lockerId) => {
    const currentReceipt = receiptInfo.details;
    setReceiptInfo({ show: false, details: null }); 
    try {
        const response = await fetch(`${API_URL}/api/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: lockerId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Check-out failed');
        
        // Fetch data immediately after a successful checkout
        fetchDashboardData();

        setModalInfo({
            show: true,
            title: 'Checkout Complete!',
            message: `Locker ${currentReceipt.lockerNumber} is now available. Amount paid: ₹${currentReceipt.fee}.`,
            isError: false,
        });
    } catch (error) {
        setModalInfo({
            show: true,
            title: 'Error!',
            message: error.message,
            isError: true,
        });
    }
  };
 
  const closeModal = () => {
    const wasCheckinSuccess = !modalInfo.isError && modalInfo.title === 'Success!';
    setModalInfo({ show: false, title: '', message: '', isError: false });
    
    // The data fetch is no longer needed here. It's tied directly to the action.
    if (wasCheckinSuccess) {
        setView('dashboard');
    }
  };

  const filteredLockers = useMemo(() => {
    return lockers
      .filter(locker => {
        if (filterType === 'All') return true;
        if (filterType === 'Occupied') return locker.status === 'Occupied';
        return locker.type === filterType;
      })
      .filter(locker => locker.number.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [lockers, filterType, searchTerm]);

  return (
    <div style={{backgroundColor: '#f8f9fa', minHeight: '100vh'}}>
      <Modal show={modalInfo.show} onClose={closeModal} title={modalInfo.title} message={modalInfo.message} isError={modalInfo.isError}/>
      <ReceiptModal show={receiptInfo.show} receipt={receiptInfo.details} onClose={() => setReceiptInfo({ show: false, details: null })} onConfirm={handleConfirmCheckout}/>
      <nav className="navbar navbar-expand-lg bg-white shadow-sm sticky-top">
        <div className="container-fluid">
          <a className="navbar-brand fw-bold d-flex align-items-center" href="#">
            <LuggageIcon className="text-primary me-2" />
            Airport Luggage Co.
          </a>
          <div className="d-flex">
              <ul className="nav nav-pills">
                <li className="nav-item">
                    <button className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>Dashboard</button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link ${view === 'checkin' ? 'active' : ''}`} onClick={() => setView('checkin')}>New Check-in</button>
                </li>
              </ul>
          </div>
        </div>
      </nav>
      <main>
        {isLoading && <div className="text-center p-5">Loading...</div>}
        {!isLoading && view === 'dashboard' ? (
          <DashboardView
            stats={stats}
            lockers={filteredLockers}
            receipts={receipts}
            onFilterChange={setFilterType}
            onSearchChange={e => setSearchTerm(e.target.value)}
            filterType={filterType}
            searchTerm={searchTerm}
            onCheckout={initiateCheckout}
          />
        ) : null}
        {!isLoading && view === 'checkin' ? (<CheckinView onCheckin={handleCheckin} />) : null}
      </main>
    </div>
  );
}
