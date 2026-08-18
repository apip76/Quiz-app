// ==========================================
// GURU DASHBOARD
// ==========================================

let currentUser = null;
let questions = [];
let currentQuizDetail = null;
let aiGeneratedQuestions = [];

// Auth state check
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('userName').textContent = user.displayName || 'Guru';
        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('welcomeName').textContent = (user.displayName || 'Guru').split(' ')[0];
        document.getElementById('userAvatar').textContent = (user.displayName || 'G').charAt(0).toUpperCase();
        loadDashboard();
    } else {
        window.location.href = 'index.html';
    }
});

// Navigation
function showSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`sec-${section}`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if (section === 'myquiz') loadMyQuizzes();
    if (section === 'dashboard') loadDashboard();

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ==========================================
// DASHBOARD
// ==========================================
async function loadDashboard() {
    try {
        const quizSnap = await db.collection('quizzes')
            .where('teacherId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();

        let totalQuestions = 0;
        const quizIds = [];
        const recentHTML = [];

        quizSnap.forEach(doc => {
            const d = doc.data();
            totalQuestions += (d.questions || []).length;
            quizIds.push(doc.id);
            if (recentHTML.length < 4) {
                recentHTML.push(createQuizCard(doc.id, d));
            }
        });

        document.getElementById('myQuizCount').textContent = quizSnap.size;
        document.getElementById('myQuestionCount').textContent = totalQuestions;

        // Count participants
        let totalParticipants = 0;
        let totalScore = 0;
        let scoreCount = 0;

        for (const qid of quizIds) {
            const resultSnap = await db.collection('results')
                .where('quizId', '==', qid).get();
            totalParticipants += resultSnap.size;
            resultSnap.forEach(doc => {
                totalScore += doc.data().score || 0;
                scoreCount++;
            });
        }

        document.getElementById('myParticipantCount').textContent = totalParticipants;
        document.getElementById('avgScore').textContent = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

        const recentContainer = document.getElementById('recentQuizzes');
        recentContainer.innerHTML = recentHTML.length > 0
            ? recentHTML.join('')
            : '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada kuis. Mulai buat kuis pertama Anda!</p></div>';

    } catch (e) {
        console.error('Dashboard error:', e);
    }
}

// ==========================================
// MY QUIZZES
// ==========================================
async function loadMyQuizzes() {
    try {
        const snap = await db.collection('quizzes')
            .where('teacherId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();

        const container = document.getElementById('myQuizList');

        if (snap.empty) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada kuis.</p></div>';
            return;
        }

        let html = '';
        snap.forEach(doc => {
            html += createQuizCard(doc.id, doc.data());
        });
        container.innerHTML = html;
    } catch (e) {
        console.error('Load quizzes error:', e);
        showToast('Gagal memuat kuis', 'error');
    }
}

function createQuizCard(id, data) {
    const qCount = (data.questions || []).length;
    return `
        <div class="quiz-card">
            <div class="quiz-card-header">
                <h3>${escapeHtml(data.title || 'Tanpa Judul')}</h3>
                <span class="quiz-card-code">${data.code || '-'}</span>
            </div>
            <span class="quiz-card-subject">${escapeHtml(data.subject || '-')}</span>
            <div class="quiz-card-info">
                <span><i class="fas fa-question-circle"></i> ${qCount} soal</span>
                <span><i class="fas fa-clock"></i> ${data.timeMinutes || 30} menit</span>
                <span><i class="fas fa-calendar"></i> ${formatDate(data.createdAt)}</span>
            </div>
            <div class="quiz-card-actions">
                <button class="btn-secondary btn-small" onclick="showShareInfo('${id}', '${data.code}')">
                    <i class="fas fa-share"></i> Share
                </button>
                <button class="btn-secondary btn-small" onclick="viewQuizDetail('${id}')">
                    <i class="fas fa-eye"></i> Detail
                </button>
                <button class="btn-danger btn-small" onclick="deleteQuiz('${id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==========================================
// CREATE QUIZ - QUESTION MANAGEMENT
// ==========================================
let questionCounter = 0;

function addQuestion(type) {
    questionCounter++;
    const id = `q_${questionCounter}_${Date.now()}`;

    const question = {
        id: id,
        type: type,
        text: '',
        options: type === 'pg' ? ['', '', '', ''] : [],
        answer: type === 'bs' ? 'benar' : (type === 'pg' ? 0 : ''),
    };

    questions.push(question);
    renderQuestions();
}

function renderQuestions() {
    const container = document.getElementById('questionsList');

    if (questions.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada soal. Klik tombol di atas untuk menambah soal atau gunakan <b>AI Generator</b>.</p></div>`;
        return;
    }

    let html = '';
    questions.forEach((q, index) => {
        html += renderQuestionItem(q, index);
    });
    container.innerHTML = html;
}

function renderQuestionItem(q, index) {
    const typeLabels = { pg: 'Pilihan Ganda', bs: 'Benar/Salah', anagram: 'Anagram' };
    let optionsHTML = '';

    if (q.type === 'pg') {
        optionsHTML = `<div class="options-edit">`;
        const labels = ['A', 'B', 'C', 'D'];
        for (let i = 0; i < 4; i++) {
            optionsHTML += `
                <div class="option-row">
                    <input type="radio" name="answer_${q.id}" value="${i}" ${q.answer === i ? 'checked' : ''} 
                           onchange="updateAnswer('${q.id}', ${i})">
                    <input type="text" value="${escapeHtml(q.options[i] || '')}" placeholder="Opsi ${labels[i]}" 
                           onchange="updateOption('${q.id}', ${i}, this.value)">
                </div>
            `;
        }
        optionsHTML += `</div>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px;"><i class="fas fa-info-circle"></i> Pilih radio button untuk jawaban yang benar</p>`;
    } else if (q.type === 'bs') {
        optionsHTML = `
            <div class="bs-options">
                <label>
                    <input type="radio" name="answer_${q.id}" value="benar" ${q.answer === 'benar' ? 'checked' : ''} 
                           onchange="updateAnswer('${q.id}', 'benar')">
                    <span>Benar</span>
                </label>
                <label>
                    <input type="radio" name="answer_${q.id}" value="salah" ${q.answer === 'salah' ? 'checked' : ''} 
                           onchange="updateAnswer('${q.id}', 'salah')">
                    <span>Salah</span>
                </label>
            </div>
        `;
    } else if (q.type === 'anagram') {
        optionsHTML = `
            <div class="form-group" style="margin-top:12px">
                <label>Jawaban (akan diacak menjadi anagram)</label>
                <input type="text" value="${escapeHtml(q.answer || '')}" placeholder="Masukkan jawaban" 
                       onchange="updateAnswer('${q.id}', this.value)">
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted);"><i class="fas fa-info-circle"></i> Huruf-huruf jawaban akan diacak otomatis menjadi anagram</p>
        `;
    }

    return `
        <div class="question-item" id="item_${q.id}">
            <div class="question-item-header">
                <div class="q-label">
                    <span>Soal ${index + 1}</span>
                    <span class="q-type-badge ${q.type}">${typeLabels[q.type]}</span>
                </div>
                <button class="btn-remove" onclick="removeQuestion('${q.id}')" title="Hapus soal">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
            <div class="form-group">
                <textarea rows="3" placeholder="Tulis pertanyaan..." onchange="updateQuestionText('${q.id}', this.value)">${escapeHtml(q.text || '')}</textarea>
            </div>
            ${optionsHTML}
        </div>
    `;
}

function updateQuestionText(id, value) {
    const q = questions.find(q => q.id === id);
    if (q) q.text = value;
}

function updateOption(id, index, value) {
    const q = questions.find(q => q.id === id);
    if (q) q.options[index] = value;
}

function updateAnswer(id, value) {
    const q = questions.find(q => q.id === id);
    if (q) q.answer = value;
}

function removeQuestion(id) {
    questions = questions.filter(q => q.id !== id);
    renderQuestions();
}

// ==========================================
// SAVE QUIZ
// ==========================================
async function saveQuiz() {
    const title = document.getElementById('quizTitle').value.trim();
    const subject = document.getElementById('quizSubject').value.trim();
    const className = document.getElementById('quizClass').value.trim();
    const timeMinutes = parseInt(document.getElementById('quizTime').value) || 30;
    const desc = document.getElementById('quizDesc').value.trim();

    if (!title) { showToast('Judul kuis wajib diisi!', 'error'); return; }
    if (!subject) { showToast('Mata pelajaran wajib diisi!', 'error'); return; }
    if (questions.length === 0) { showToast('Tambahkan minimal 1 soal!', 'error'); return; }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.text.trim()) {
            showToast(`Soal ${i + 1} belum diisi!`, 'error');
            return;
        }
        if (q.type === 'pg') {
            if (q.options.some(o => !o.trim())) {
                showToast(`Opsi soal ${i + 1} belum lengkap!`, 'error');
                return;
            }
        }
        if (q.type === 'anagram' && !q.answer.trim()) {
            showToast(`Jawaban soal ${i + 1} (anagram) belum diisi!`, 'error');
            return;
        }
    }

    const code = generateCode(6);

    // Clean questions for storage
    const cleanQuestions = questions.map((q, idx) => ({
        index: idx,
        type: q.type,
        text: q.text.trim(),
        options: q.type === 'pg' ? q.options.map(o => o.trim()) : [],
        answer: q.type === 'pg' ? parseInt(q.answer) : (q.type === 'anagram' ? q.answer.trim().toUpperCase() : q.answer),
    }));

    try {
        const docRef = await db.collection('quizzes').add({
            title: title,
            subject: subject,
            className: className,
            timeMinutes: timeMinutes,
            description: desc,
            code: code,
            teacherId: currentUser.uid,
            teacherName: currentUser.displayName || 'Guru',
            questions: cleanQuestions,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Kuis berhasil disimpan!', 'success');
        showShareInfo(docRef.id, code);

        // Reset form
        document.getElementById('quizTitle').value = '';
        document.getElementById('quizSubject').value = '';
        document.getElementById('quizClass').value = '';
        document.getElementById('quizTime').value = '30';
        document.getElementById('quizDesc').value = '';
        questions = [];
        renderQuestions();

    } catch (e) {
        console.error('Save error:', e);
        showToast('Gagal menyimpan kuis: ' + e.message, 'error');
    }
}

function showShareInfo(quizId, code) {
    document.getElementById('shareCode').textContent = code;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/quiz.html?id=${quizId}`;
    document.getElementById('shareLink').value = link;
    document.getElementById('shareModal').classList.add('active');
}

function copyLink() {
    const link = document.getElementById('shareLink').value;
    navigator.clipboard.writeText(link).then(() => {
        showToast('Link berhasil disalin!', 'success');
    }).catch(() => {
        document.getElementById('shareLink').select();
        document.execCommand('copy');
        showToast('Link berhasil disalin!', 'success');
    });
}

function shareWA() {
    const link = document.getElementById('shareLink').value;
    const code = document.getElementById('shareCode').textContent;
    const text = `📝 *Quiz Online - QuizMaster*\n\nKode Kuis: *${code}*\nLink: ${link}\n\nSilakan kerjakan kuis di link di atas. Selamat mengerjakan! 💪`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareTelegram() {
    const link = document.getElementById('shareLink').value;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Kerjakan kuis ini!')}`, '_blank');
}

// ==========================================
// VIEW QUIZ DETAIL
// ==========================================
async function viewQuizDetail(quizId) {
    currentQuizDetail = quizId;
    try {
        const doc = await db.collection('quizzes').doc(quizId).get();
        if (!doc.exists) { showToast('Kuis tidak ditemukan', 'error'); return; }

        const data = doc.data();
        document.getElementById('detailTitle').textContent = data.title;

        // Info tab
        const qs = data.questions || [];
        let typeCounts = { pg: 0, bs: 0, anagram: 0 };
        qs.forEach(q => { typeCounts[q.type] = (typeCounts[q.type] || 0) + 1; });

        document.getElementById('detailInfo').innerHTML = `
            <div class="quiz-info-card" style="background: var(--bg-dark)">
                <div class="quiz-info-row"><span>Mata Pelajaran</span><span>${escapeHtml(data.subject)}</span></div>
                <div class="quiz-info-row"><span>Kelas</span><span>${escapeHtml(data.className || '-')}</span></div>
                <div class="quiz-info-row"><span>Kode</span><span style="font-weight:800; color:var(--primary-light)">${data.code}</span></div>
                <div class="quiz-info-row"><span>Waktu</span><span>${data.timeMinutes} menit</span></div>
                <div class="quiz-info-row"><span>Jumlah Soal</span><span>${qs.length}</span></div>
                <div class="quiz-info-row"><span>Pilihan Ganda</span><span>${typeCounts.pg}</span></div>
                <div class="quiz-info-row"><span>Benar/Salah</span><span>${typeCounts.bs}</span></div>
                <div class="quiz-info-row"><span>Anagram</span><span>${typeCounts.anagram}</span></div>
                <div class="quiz-info-row"><span>Dibuat</span><span>${formatDate(data.createdAt)}</span></div>
            </div>
        `;

        // Load results
        await loadQuizResults(quizId);

        document.getElementById('detailModal').classList.add('active');
        switchDetailTab('info');

    } catch (e) {
        console.error('Detail error:', e);
        showToast('Gagal memuat detail', 'error');
    }
}

async function loadQuizResults(quizId) {
    try {
        const snap = await db.collection('results')
            .where('quizId', '==', quizId)
            .orderBy('score', 'desc')
            .get();

        const container = document.getElementById('resultsTable');

        if (snap.empty) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Belum ada peserta yang mengerjakan.</p></div>';
            return;
        }

        let html = `
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Peringkat</th>
                        <th>Nama</th>
                        <th>Kelas</th>
                        <th>NIS</th>
                        <th>Benar</th>
                        <th>Salah</th>
                        <th>Skor</th>
                        <th>Waktu</th>
                        <th>Tanggal</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let rank = 1;
        snap.forEach(doc => {
            const d = doc.data();
            const rankClass = rank <= 3 ? `rank-${rank}` : '';
            const scoreClass = d.score >= 80 ? 'score-high' : (d.score >= 60 ? 'score-mid' : 'score-low');
            html += `
                <tr>
                    <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                    <td><b>${escapeHtml(d.studentName || '-')}</b></td>
                    <td>${escapeHtml(d.studentClass || '-')}</td>
                    <td>${escapeHtml(d.studentId || '-')}</td>
                    <td>${d.correct || 0}</td>
                    <td>${d.wrong || 0}</td>
                    <td><span class="score-badge ${scoreClass}">${d.score || 0}</span></td>
                    <td>${d.timeSpent || '-'}</td>
                    <td>${formatDate(d.submittedAt)}</td>
                </tr>
            `;
            rank++;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (e) {
        console.error('Results error:', e);
    }
}

function switchDetailTab(tab) {
    document.querySelectorAll('#detailModal .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#detailModal .tab-content').forEach(c => c.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById(tab === 'info' ? 'detailInfo' : 'detailResults').classList.add('active');
}

// ==========================================
// DOWNLOAD EXCEL
// ==========================================
async function downloadExcel() {
    if (!currentQuizDetail) return;

    try {
        const quizDoc = await db.collection('quizzes').doc(currentQuizDetail).get();
        const quizData = quizDoc.data();

        const snap = await db.collection('results')
            .where('quizId', '==', currentQuizDetail)
            .orderBy('score', 'desc')
            .get();

        if (snap.empty) {
            showToast('Belum ada data untuk didownload', 'error');
            return;
        }

        const rows = [['Peringkat', 'Nama', 'Kelas', 'NIS/Absen', 'Benar', 'Salah', 'Skor', 'Waktu Pengerjaan', 'Tanggal']];
        let rank = 1;
        snap.forEach(doc => {
            const d = doc.data();
            rows.push([
                rank++,
                d.studentName || '-',
                d.studentClass || '-',
                d.studentId || '-',
                d.correct || 0,
                d.wrong || 0,
                d.score || 0,
                d.timeSpent || '-',
                d.submittedAt ? formatDate(d.submittedAt) : '-'
            ]);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Column widths
        ws['!cols'] = [
            { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 20 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Hasil Kuis');
        XLSX.writeFile(wb, `Hasil_${quizData.title || 'Kuis'}_${quizData.code || ''}.xlsx`);

        showToast('File Excel berhasil didownload!', 'success');
    } catch (e) {
        console.error('Excel error:', e);
        showToast('Gagal download Excel', 'error');
    }
}

// ==========================================
// DELETE QUIZ
// ==========================================
async function deleteQuiz(quizId) {
    if (!confirm('Yakin ingin menghapus kuis ini? Semua data hasil akan ikut terhapus.')) return;

    try {
        // Delete results
        const resultSnap = await db.collection('results').where('quizId', '==', quizId).get();
        const batch = db.batch();
        resultSnap.forEach(doc => batch.delete(doc.ref));
        batch.delete(db.collection('quizzes').doc(quizId));
        await batch.commit();

        showToast('Kuis berhasil dihapus!', 'success');
        loadMyQuizzes();
        loadDashboard();
    } catch (e) {
        showToast('Gagal menghapus kuis', 'error');
    }
}

// ==========================================
// AI QUESTION GENERATOR
// ==========================================
function generateAI() {
    const subject = document.getElementById('aiSubject').value.trim();
    const topic = document.getElementById('aiTopic').value.trim();
    const difficulty = document.getElementById('aiDifficulty').value;
    const level = document.getElementById('aiLevel').value;
    const type = document.getElementById('aiType').value;
    const count = parseInt(document.getElementById('aiCount').value) || 5;

    if (!subject || !topic) {
        showToast('Mohon isi mata pelajaran dan topik!', 'error');
        return;
    }

    const typeNames = {
        pg: 'Pilihan Ganda (4 opsi A-D)',
        bs: 'Benar/Salah',
        anagram: 'Isian Singkat (jawaban 1-2 kata)',
        campuran: 'Campuran (Pilihan Ganda, Benar/Salah, dan Isian Singkat)'
    };

    const difficultyDesc = {
        mudah: 'mudah (mengingat & memahami, C1-C2 Taksonomi Bloom)',
        sedang: 'sedang (menerapkan & menganalisis, C3-C4 Taksonomi Bloom)',
        sulit: 'sulit (mengevaluasi & mencipta, C5-C6 Taksonomi Bloom)'
    };

    const prompt = `Kamu adalah seorang guru ${subject} profesional tingkat ${level}. Buatkan ${count} soal ${typeNames[type]} tentang materi "${topic}" dengan tingkat kesulitan ${difficultyDesc[difficulty]}.

KETENTUAN PENTING:
1. Soal harus valid secara keilmuan dan sesuai kurikulum ${level} Indonesia
2. Bahasa Indonesia yang baku dan jelas
3. Hindari soal yang ambigu
4. Setiap soal harus memiliki SATU jawaban yang pasti benar
${type === 'pg' || type === 'campuran' ? '5. Untuk pilihan ganda: 4 opsi (A-D), pengecoh harus masuk akal tapi jelas salah' : ''}
${type === 'anagram' || type === 'campuran' ? '6. Untuk isian singkat: jawaban hanya 1-2 kata' : ''}

FORMAT OUTPUT (JSON ARRAY):
[
  {
    "type": "pg" | "bs" | "anagram",
    "text": "Teks pertanyaan",
    "options": ["A", "B", "C", "D"],  // hanya untuk type pg
    "answer": 0  // untuk pg: index jawaban (0-3), untuk bs: "benar"/"salah", untuk anagram: "JAWABAN"
  }
]

Berikan HANYA JSON array, tanpa penjelasan tambahan.`;

    // Show prompt
    document.getElementById('promptBox').textContent = prompt;

    // Generate sample questions locally (simulated AI)
    const sampleQuestions = generateSampleQuestions(subject, topic, type, count, difficulty);
    displayAIResult(sampleQuestions);
    aiGeneratedQuestions = sampleQuestions;

    showToast('Soal contoh berhasil digenerate! Copy prompt di bawah untuk hasil lebih baik via ChatGPT/Gemini.', 'info');
}

function generateSampleQuestions(subject, topic, type, count, difficulty) {
    const result = [];

    for (let i = 0; i < count; i++) {
        let qType = type;
        if (type === 'campuran') {
            const types = ['pg', 'bs', 'anagram'];
            qType = types[i % 3];
        }

        if (qType === 'pg') {
            result.push({
                type: 'pg',
                text: `[${subject}] Pertanyaan ${i + 1} tentang ${topic} (${difficulty}). Silakan ganti dengan pertanyaan yang sebenarnya melalui AI Generator atau edit manual.`,
                options: ['Pilihan jawaban A', 'Pilihan jawaban B', 'Pilihan jawaban C', 'Pilihan jawaban D'],
                answer: 0
            });
        } else if (qType === 'bs') {
            result.push({
                type: 'bs',
                text: `[${subject}] Pernyataan ${i + 1} tentang ${topic} (${difficulty}). Silakan ganti dengan pernyataan yang sebenarnya.`,
                options: [],
                answer: 'benar'
            });
        } else {
            result.push({
                type: 'anagram',
                text: `[${subject}] Pertanyaan isian ${i + 1} tentang ${topic} (${difficulty}). Silakan ganti dengan pertanyaan yang sebenarnya.`,
                options: [],
                answer: 'JAWABAN'
            });
        }
    }

    return result;
}

function displayAIResult(questions) {
    const container = document.getElementById('aiResult');
    const typeLabels = { pg: 'Pilihan Ganda', bs: 'Benar/Salah', anagram: 'Anagram' };

    let html = '';
    questions.forEach((q, i) => {
        let optsHtml = '';
        if (q.type === 'pg') {
            const labels = ['A', 'B', 'C', 'D'];
            optsHtml = `<div class="q-opts">${q.options.map((o, j) => `<div>${labels[j]}. ${escapeHtml(o)} ${j === q.answer ? '✅' : ''}</div>`).join('')}</div>`;
        } else if (q.type === 'bs') {
            optsHtml = `<div class="q-answer">Jawaban: ${q.answer === 'benar' ? '✅ Benar' : '❌ Salah'}</div>`;
        } else {
            optsHtml = `<div class="q-answer">Jawaban: ${escapeHtml(q.answer)}</div>`;
        }

        html += `
            <div class="ai-question-item">
                <div class="q-label" style="margin-bottom:8px"><span class="q-type-badge ${q.type}">${typeLabels[q.type]}</span> Soal ${i + 1}</div>
                <div class="q-text">${escapeHtml(q.text)}</div>
                ${optsHtml}
            </div>
        `;
    });

    container.innerHTML = html;
    document.getElementById('aiActions').style.display = 'flex';
}

function useAIQuestions() {
    if (aiGeneratedQuestions.length === 0) {
        showToast('Belum ada soal yang digenerate', 'error');
        return;
    }

    aiGeneratedQuestions.forEach(q => {
        questionCounter++;
        questions.push({
            id: `q_${questionCounter}_${Date.now()}`,
            type: q.type,
            text: q.text,
            options: q.options || [],
            answer: q.answer
        });
    });

    renderQuestions();
    showSection('create');
    document.querySelector('[onclick="showSection(\'create\')"]').classList.add('active');
    showToast(`${aiGeneratedQuestions.length} soal berhasil ditambahkan!`, 'success');
}

function copyAIPrompt() {
    copyPromptText();
}

function copyPromptText() {
    const prompt = document.getElementById('promptBox').textContent;
    navigator.clipboard.writeText(prompt).then(() => {
        showToast('Prompt berhasil disalin! Paste ke ChatGPT atau Gemini.', 'success');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = prompt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Prompt berhasil disalin!', 'success');
    });
}

function previewQuiz() {
    if (questions.length === 0) {
        showToast('Tambahkan minimal 1 soal untuk preview', 'error');
        return;
    }
    showToast('Preview: ' + questions.length + ' soal siap digunakan', 'info');
}