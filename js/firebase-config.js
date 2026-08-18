// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCvbtOHMYF5QGbw74TcHTT5WIPJRfTbQ9c",
    authDomain: "penilaian-harian-68ef6.firebaseapp.com",
    projectId: "penilaian-harian-68ef6",
    storageBucket: "penilaian-harian-68ef6.firebasestorage.app",
    messagingSenderId: "1063088378595",
    appId: "1:1063088378595:web:eeea2d92555e3e486d2bd6",
    measurementId: "G-GBXLYYC98L"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Close modal helper
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Generate unique code
function generateCode(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Shuffle array (Fisher-Yates)
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return '-';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}