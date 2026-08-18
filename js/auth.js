// Authentication Functions

async function loginGuru() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('Mohon isi email dan password!', 'error');
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Login berhasil!', 'success');
        window.location.href = 'guru.html';
    } catch (e) {
        let msg = 'Gagal login.';
        if (e.code === 'auth/user-not-found') msg = 'Akun tidak ditemukan.';
        else if (e.code === 'auth/wrong-password') msg = 'Password salah.';
        else if (e.code === 'auth/invalid-email') msg = 'Format email salah.';
        else if (e.code === 'auth/invalid-credential') msg = 'Email atau password salah.';
        showToast(msg, 'error');
    }
}

async function registerGuru() {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!name || !email || !password) {
        showToast('Mohon lengkapi semua data!', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('Password minimal 6 karakter!', 'error');
        return;
    }

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });

        // Save to Firestore
        await db.collection('teachers').doc(cred.user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Registrasi berhasil!', 'success');
        window.location.href = 'guru.html';
    } catch (e) {
        let msg = 'Gagal mendaftar.';
        if (e.code === 'auth/email-already-in-use') msg = 'Email sudah terdaftar.';
        else if (e.code === 'auth/weak-password') msg = 'Password terlalu lemah.';
        showToast(msg, 'error');
    }
}

async function loginGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        // Save/update teacher data
        await db.collection('teachers').doc(user.uid).set({
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL || '',
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast('Login berhasil!', 'success');
        window.location.href = 'guru.html';
    } catch (e) {
        if (e.code !== 'auth/popup-closed-by-user') {
            showToast('Gagal login dengan Google: ' + e.message, 'error');
        }
    }
}

function logoutGuru() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}

// Enter key handlers
document.addEventListener('DOMContentLoaded', () => {
    const loginPass = document.getElementById('loginPassword');
    if (loginPass) {
        loginPass.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loginGuru();
        });
    }
    const regPass = document.getElementById('regPassword');
    if (regPass) {
        regPass.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') registerGuru();
        });
    }
});