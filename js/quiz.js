// ==========================================
// QUIZ PLAYER
// ==========================================

let quizData = null;
let shuffledQuestions = [];
let currentIndex = 0;
let answers = {};
let timerInterval = null;
let timeLeft = 0;
let startTime = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    loadQuizInfo();
});

function createParticles() {
    const c = document.getElementById('particles');
    if (!c) return;
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.animationDelay = Math.random() * 5 + 's';
        p.style.animationDuration = (Math.random() * 10 + 10) + 's';
        c.appendChild(p);
    }
}

async function loadQuizInfo() {
    const params = new URLSearchParams(window.location.search);
    const quizId = params.get('id');

    if (!quizId) {
        document.getElementById('quizInfoCard').innerHTML = `
            <div class="empty-state" style="padding:20px">
                <i class="fas fa-exclamation-triangle" style="color:var(--warning)"></i>
                <p>Kuis tidak ditemukan. Pastikan link yang Anda gunakan benar.</p>
                <a href="index.html" class="btn-primary" style="margin-top:12px"><i class="fas fa-home"></i> Kembali</a>
            </div>
        `;
        return;
    }

    try {
        const doc = await db.collection('quizzes').doc(quizId).get();

        if (!doc.exists) {
            document.getElementById('quizInfoCard').innerHTML = `
                <div class="empty-state" style="padding:20px">
                    <i class="fas fa-exclamation-triangle" style="color:var(--warning)"></i>
                    <p>Kuis tidak ditemukan atau telah dihapus.</p>
                    <a href="index.html" class="btn-primary" style="margin-top:12px"><i class="fas fa-home"></i> Kembali</a>
                </div>
            `;
            return;
        }

        quizData = { id: doc.id, ...doc.data() };
        const qs = quizData.questions || [];
        let typeCounts = { pg: 0, bs: 0, anagram: 0 };
        qs.forEach(q => { typeCounts[q.type] = (typeCounts[q.type] || 0) + 1; });

        let typeInfo = [];
        if (typeCounts.pg > 0) typeInfo.push(`${typeCounts.pg} Pilihan Ganda`);
        if (typeCounts.bs > 0) typeInfo.push(`${typeCounts.bs} Benar/Salah`);
        if (typeCounts.anagram > 0) typeInfo.push(`${typeCounts.anagram} Anagram`);

        document.getElementById('quizInfoCard').innerHTML = `
            <h2>${escapeHtml(quizData.title)}</h2>
            ${quizData.description ? `<p style="color:var(--text-secondary); margin-bottom:12px">${escapeHtml(quizData.description)}</p>` : ''}
            <div class="quiz-info-row"><span>Mata Pelajaran</span><span>${escapeHtml(quizData.subject)}</span></div>
            <div class="quiz-info-row"><span>Guru</span><span>${escapeHtml(quizData.teacherName || '-')}</span></div>
            <div class="quiz-info-row"><span>Jumlah Soal</span><span>${qs.length} soal</span></div>
            <div class="quiz-info-row"><span>Tipe Soal</span><span>${typeInfo.join(', ')}</span></div>
            <div class="quiz-info-row"><span>Waktu</span><span>${quizData.timeMinutes || 30} menit</span></div>
        `;

        document.getElementById('entryForm').style.display = 'block';

    } catch (e) {
        console.error('Load quiz error:', e);
        document.getElementById('quizInfoCard').innerHTML = `
            <div class="empty-state" style="padding:20px">
                <i class="fas fa-exclamation-circle" style="color:var(--danger)"></i>
                <p>Terjadi kesalahan saat memuat kuis. Coba refresh halaman.</p>
            </div>
        `;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==========================================
// START QUIZ
// ==========================================
function startQuiz() {
    const name = document.getElementById('studentName').value.trim();
    const studentId = document.getElementById('studentId').value.trim();
    const studentClass = document.getElementById('studentClass').value.trim();

    if (!name) { showToast('Masukkan nama Anda!', 'error'); return; }
    if (!studentId) { showToast('Masukkan NIS/nomor absen!', 'error'); return; }

    // Store student info
    quizData.studentName = name;
    quizData.studentId = studentId;
    quizData.studentClass = studentClass;

    // Shuffle questions
    shuffledQuestions = shuffleArray(quizData.questions).map((q, newIndex) => {
        const newQ = { ...q, originalIndex: q.index };

        // Shuffle options for PG
        if (q.type === 'pg' && q.options) {
            const optionsWithIndex = q.options.map((opt, idx) => ({ text: opt, origIndex: idx }));
            const shuffled = shuffleArray(optionsWithIndex);
            newQ.shuffledOptions = shuffled.map(o => o.text);
            // Map original answer index to new index
            newQ.correctShuffledIndex = shuffled.findIndex(o => o.origIndex === q.answer);
        }

        // Create anagram for anagram type
        if (q.type === 'anagram' && q.answer) {
            const letters = q.answer.replace(/\s/g, '').split('');
            let shuffled = shuffleArray(letters);
            // Make sure it's actually shuffled
            let attempts = 0;
            while (shuffled.join('') === letters.join('') && attempts < 10) {
                shuffled = shuffleArray(letters);
                attempts++;
            }
            newQ.anagramLetters = shuffled;
        }

        return newQ;
    });

    // Setup UI
    document.getElementById('entryScreen').style.display = 'none';
    document.getElementById('quizScreen').style.display = 'flex';
    document.getElementById('qSubject').textContent = quizData.subject;
    document.getElementById('totalQ').textContent = shuffledQuestions.length;
    document.getElementById('totalCount').textContent = shuffledQuestions.length;

    // Setup timer
    timeLeft = (quizData.timeMinutes || 30) * 60;
    startTime = Date.now();
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);

    // Build navigator
    buildNavigator();

    // Show first question
    showQuestion(0);
}

// ==========================================
// TIMER
// ==========================================
function updateTimer() {
    if (timeLeft <= 0) {
        clearInterval(timerInterval);
        showToast('Waktu habis! Jawaban otomatis dikumpulkan.', 'warning');
        submitQuiz(true);
        return;
    }

    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const timerText = document.getElementById('timerText');
    timerText.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const timer = document.getElementById('timer');
    if (timeLeft <= 60) {
        timer.className = 'timer danger';
    } else if (timeLeft <= 300) {
        timer.className = 'timer warning';
    }

    timeLeft--;
}

// ==========================================
// SHOW QUESTION
// ==========================================
function showQuestion(index) {
    currentIndex = index;
    const q = shuffledQuestions[index];

    document.getElementById('currentQ').textContent = index + 1;
    document.getElementById('questionNumber').textContent = `Soal ${index + 1}`;

    // Type badge
    const typeEl = document.getElementById('questionType');
    if (q.type === 'pg') {
        typeEl.textContent = 'Pilihan Ganda';
        typeEl.className = 'question-type type-pg';
    } else if (q.type === 'bs') {
        typeEl.textContent = 'Benar / Salah';
        typeEl.className = 'question-type type-bs';
    } else {
        typeEl.textContent = 'Anagram';
        typeEl.className = 'question-type type-anagram';
    }

    document.getElementById('questionText').textContent = q.text;

    // Progress
    const progress = ((index + 1) / shuffledQuestions.length) * 100;
    document.getElementById('progressBar').style.width = progress + '%';

    // Options
    const optContainer = document.getElementById('optionsContainer');
    optContainer.innerHTML = '';

    if (q.type === 'pg') {
        renderPGOptions(q, optContainer);
    } else if (q.type === 'bs') {
        renderBSOptions(q, optContainer);
    } else if (q.type === 'anagram') {
        renderAnagramOptions(q, optContainer);
    }

    // Nav buttons
    document.getElementById('btnPrev').disabled = index === 0;
    const btnNext = document.getElementById('btnNext');
    if (index === shuffledQuestions.length - 1) {
        btnNext.innerHTML = 'Selesai <i class="fas fa-check"></i>';
        btnNext.onclick = () => submitQuiz();
    } else {
        btnNext.innerHTML = 'Selanjutnya <i class="fas fa-chevron-right"></i>';
        btnNext.onclick = () => nextQuestion();
    }

    // Update dots
    updateNavigator();

    // Animate
    document.getElementById('questionCard').style.animation = 'none';
    setTimeout(() => {
        document.getElementById('questionCard').style.animation = 'fadeIn 0.3s ease';
    }, 10);
}

function renderPGOptions(q, container) {
    const labels = ['A', 'B', 'C', 'D'];
    const options = q.shuffledOptions || q.options;
    const currentAnswer = answers[currentIndex];

    options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = `option-btn ${currentAnswer === i ? 'selected' : ''}`;
        btn.innerHTML = `
            <span class="option-label">${labels[i]}</span>
            <span class="option-text">${escapeHtml(opt)}</span>
        `;
        btn.onclick = () => selectPGOption(i);
        container.appendChild(btn);
    });
}

function selectPGOption(index) {
    answers[currentIndex] = index;
    // Update UI
    document.querySelectorAll('.option-btn').forEach((btn, i) => {
        btn.classList.toggle('selected', i === index);
    });
    updateNavigator();
    updateAnsweredCount();
}

function renderBSOptions(q, container) {
    const currentAnswer = answers[currentIndex];

    ['Benar', 'Salah'].forEach(val => {
        const btn = document.createElement('button');
        const isSelected = currentAnswer === val.toLowerCase();
        btn.className = `option-btn ${isSelected ? 'selected' : ''}`;
        btn.innerHTML = `
            <span class="option-label">${val === 'Benar' ? '✓' : '✗'}</span>
            <span class="option-text">${val}</span>
        `;
        btn.onclick = () => {
            answers[currentIndex] = val.toLowerCase();
            document.querySelectorAll('.option-btn').forEach((b, i) => {
                b.classList.toggle('selected', i === ['Benar', 'Salah'].indexOf(val));
            });
            updateNavigator();
            updateAnsweredCount();
        };
        container.appendChild(btn);
    });
}

function renderAnagramOptions(q, container) {
    const letters = q.anagramLetters || [];
    const currentAnswer = answers[currentIndex] || { letters: [], usedIndices: [] };

    container.innerHTML = `
        <div class="anagram-container">
            <div class="anagram-hint">
                <i class="fas fa-puzzle-piece"></i> Susun huruf-huruf berikut menjadi jawaban yang benar (${letters.length} huruf)
            </div>
            <div class="anagram-answer" id="anagramAnswer"></div>
            <div class="anagram-letters" id="anagramLetters"></div>
            <div class="anagram-clear">
                <button onclick="clearAnagram()"><i class="fas fa-undo"></i> Reset</button>
            </div>
        </div>
    `;

    const lettersContainer = document.getElementById('anagramLetters');
    const answerContainer = document.getElementById('anagramAnswer');

    // Render available letters
    letters.forEach((letter, i) => {
        const el = document.createElement('div');
        el.className = `anagram-letter ${currentAnswer.usedIndices.includes(i) ? 'used' : ''}`;
        el.textContent = letter;
        el.onclick = () => addAnagramLetter(i, letter);
        el.dataset.index = i;
        lettersContainer.appendChild(el);
    });

    // Render current answer
    currentAnswer.letters.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'anagram-answer-letter';
        el.textContent = item.letter;
        el.onclick = () => removeAnagramLetter(i);
        answerContainer.appendChild(el);
    });
}

function addAnagramLetter(index, letter) {
    if (!answers[currentIndex]) {
        answers[currentIndex] = { letters: [], usedIndices: [] };
    }

    if (answers[currentIndex].usedIndices.includes(index)) return;

    answers[currentIndex].letters.push({ letter, sourceIndex: index });
    answers[currentIndex].usedIndices.push(index);

    // Update UI
    const letterEl = document.querySelector(`.anagram-letter[data-index="${index}"]`);
    if (letterEl) letterEl.classList.add('used');

    const answerContainer = document.getElementById('anagramAnswer');
    const el = document.createElement('div');
    el.className = 'anagram-answer-letter';
    el.textContent = letter;
    el.onclick = () => removeAnagramLetter(answers[currentIndex].letters.length - 1);
    answerContainer.appendChild(el);

    updateNavigator();
    updateAnsweredCount();
}

function removeAnagramLetter(answerIndex) {
    const answer = answers[currentIndex];
    if (!answer || !answer.letters[answerIndex]) return;

    const removed = answer.letters.splice(answerIndex, 1)[0];
    const usedIdx = answer.usedIndices.indexOf(removed.sourceIndex);
    if (usedIdx > -1) answer.usedIndices.splice(usedIdx, 1);

    // Re-render
    const q = shuffledQuestions[currentIndex];
    renderAnagramOptions(q, document.getElementById('optionsContainer'));

    if (answer.letters.length === 0) {
        delete answers[currentIndex];
    }

    updateNavigator();
    updateAnsweredCount();
}

function clearAnagram() {
    delete answers[currentIndex];
    const q = shuffledQuestions[currentIndex];
    renderAnagramOptions(q, document.getElementById('optionsContainer'));
    updateNavigator();
    updateAnsweredCount();
}

// ==========================================
// NAVIGATION
// ==========================================
function nextQuestion() {
    if (currentIndex < shuffledQuestions.length - 1) {
        showQuestion(currentIndex + 1);
    }
}

function prevQuestion() {
    if (currentIndex > 0) {
        showQuestion(currentIndex - 1);
    }
}

function buildNavigator() {
    const grid = document.getElementById('navigatorGrid');
    const dots = document.getElementById('questionDots');
    grid.innerHTML = '';
    dots.innerHTML = '';

    shuffledQuestions.forEach((q, i) => {
        // Navigator grid
        const navDot = document.createElement('div');
        navDot.className = 'nav-dot';
        navDot.textContent = i + 1;
        navDot.onclick = () => {
            showQuestion(i);
            toggleNavigator();
        };
        grid.appendChild(navDot);

        // Top dots
        const dot = document.createElement('div');
        dot.className = 'q-dot';
        dot.onclick = () => showQuestion(i);
        dots.appendChild(dot);
    });
}

function updateNavigator() {
    const navDots = document.querySelectorAll('.nav-dot');
    const qDots = document.querySelectorAll('.q-dot');

    navDots.forEach((dot, i) => {
        dot.classList.remove('answered', 'current');
        if (answers[i] !== undefined) dot.classList.add('answered');
        if (i === currentIndex) dot.classList.add('current');
    });

    qDots.forEach((dot, i) => {
        dot.classList.remove('answered', 'current');
        if (answers[i] !== undefined) dot.classList.add('answered');
        if (i === currentIndex) dot.classList.add('current');
    });
}

function updateAnsweredCount() {
    const count = Object.keys(answers).length;
    document.getElementById('answeredCount').textContent = count;
}

function toggleNavigator() {
    document.getElementById('navigatorPanel').classList.toggle('open');
}

// ==========================================
// SUBMIT QUIZ
// ==========================================
async function submitQuiz(autoSubmit = false) {
    if (!autoSubmit) {
        const answered = Object.keys(answers).length;
        const total = shuffledQuestions.length;
        if (answered < total) {
            if (!confirm(`Anda baru menjawab ${answered} dari ${total} soal. Yakin ingin mengumpulkan?`)) {
                return;
            }
        } else {
            if (!confirm('Yakin ingin mengumpulkan jawaban?')) return;
        }
    }

    clearInterval(timerInterval);

    // Calculate score
    let correct = 0;
    let wrong = 0;

    shuffledQuestions.forEach((q, i) => {
        const userAnswer = answers[i];
        let isCorrect = false;

        if (q.type === 'pg') {
            // Compare shuffled index to correct shuffled index
            isCorrect = userAnswer === q.correctShuffledIndex;
        } else if (q.type === 'bs') {
            isCorrect = userAnswer === q.answer;
        } else if (q.type === 'anagram') {
            if (userAnswer && userAnswer.letters) {
                const userStr = userAnswer.letters.map(l => l.letter).join('').toUpperCase();
                isCorrect = userStr === q.answer.replace(/\s/g, '').toUpperCase();
            }
        }

        if (userAnswer !== undefined) {
            if (isCorrect) correct++;
            else wrong++;
        } else {
            wrong++;
        }
    });

    const total = shuffledQuestions.length;
    const score = Math.round((correct / total) * 100);

    // Time spent
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeSpent = `${mins}m ${secs}s`;

    // Save to Firebase
    try {
        await db.collection('results').add({
            quizId: quizData.id,
            quizTitle: quizData.title,
            studentName: quizData.studentName,
            studentId: quizData.studentId,
            studentClass: quizData.studentClass,
            score: score,
            correct: correct,
            wrong: wrong,
            total: total,
            timeSpent: timeSpent,
            timeSeconds: elapsed,
            answers: serializeAnswers(),
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('Save result error:', e);
    }

    // Show result
    showResult(score, correct, wrong, timeSpent);
}

function serializeAnswers() {
    const result = {};
    Object.keys(answers).forEach(key => {
        const val = answers[key];
        if (typeof val === 'object' && val.letters) {
            result[key] = val.letters.map(l => l.letter).join('');
        } else {
            result[key] = val;
        }
    });
    return result;
}

// ==========================================
// SHOW RESULT
// ==========================================
function showResult(score, correct, wrong, timeSpent) {
    document.getElementById('quizScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'flex';

    // Icon & title based on score
    const icon = document.getElementById('resultIcon');
    const title = document.getElementById('resultTitle');
    const subtitle = document.getElementById('resultSubtitle');

    if (score >= 90) {
        icon.textContent = '🏆';
        title.textContent = 'Luar Biasa!';
        subtitle.textContent = 'Hasil yang sempurna! Kamu menguasai materi ini.';
    } else if (score >= 70) {
        icon.textContent = '🎉';
        title.textContent = 'Bagus!';
        subtitle.textContent = 'Hasil yang baik! Terus tingkatkan ya.';
    } else if (score >= 50) {
        icon.textContent = '💪';
        title.textContent = 'Cukup Baik';
        subtitle.textContent = 'Masih ada yang perlu dipelajari lagi.';
    } else {
        icon.textContent = '📚';
        title.textContent = 'Tetap Semangat!';
        subtitle.textContent = 'Jangan menyerah, pelajari lagi materinya ya.';
    }

    document.getElementById('correctCount').textContent = correct;
    document.getElementById('wrongCount').textContent = wrong;
    document.getElementById('timeSpent').textContent = timeSpent;

    // Animate score circle
    setTimeout(() => {
        document.getElementById('scoreCircle').style.strokeDasharray = `${score}, 100`;
        document.getElementById('scoreValue').textContent = score;

        // Change circle color based on score
        const circle = document.getElementById('scoreCircle');
        if (score >= 80) circle.style.stroke = '#22c55e';
        else if (score >= 60) circle.style.stroke = '#f59e0b';
        else circle.style.stroke = '#ef4444';
    }, 300);
}

// ==========================================
// REVIEW
// ==========================================
function viewReview() {
    const container = document.getElementById('reviewContent');
    let html = '';

    shuffledQuestions.forEach((q, i) => {
        const userAnswer = answers[i];
        let isCorrect = false;
        let userAnswerText = 'Tidak dijawab';
        let correctAnswerText = '';

        if (q.type === 'pg') {
            const labels = ['A', 'B', 'C', 'D'];
            const options = q.shuffledOptions || q.options;
            isCorrect = userAnswer === q.correctShuffledIndex;
            userAnswerText = userAnswer !== undefined ? `${labels[userAnswer]}. ${options[userAnswer]}` : 'Tidak dijawab';
            correctAnswerText = `${labels[q.correctShuffledIndex]}. ${options[q.correctShuffledIndex]}`;
        } else if (q.type === 'bs') {
            isCorrect = userAnswer === q.answer;
            userAnswerText = userAnswer ? (userAnswer.charAt(0).toUpperCase() + userAnswer.slice(1)) : 'Tidak dijawab';
            correctAnswerText = q.answer.charAt(0).toUpperCase() + q.answer.slice(1);
        } else if (q.type === 'anagram') {
            const userStr = userAnswer && userAnswer.letters ? userAnswer.letters.map(l => l.letter).join('') : '';
            isCorrect = userStr.toUpperCase() === q.answer.replace(/\s/g, '').toUpperCase();
            userAnswerText = userStr || 'Tidak dijawab';
            correctAnswerText = q.answer;
        }

        html += `
            <div class="review-item ${isCorrect ? 'correct' : 'wrong'}">
                <div class="review-q">
                    <span style="color:${isCorrect ? 'var(--success)' : 'var(--danger)'}">
                        ${isCorrect ? '✅' : '❌'} Soal ${i + 1}
                    </span>
                    <span class="q-type-badge ${q.type}" style="margin-left:8px">${q.type === 'pg' ? 'PG' : (q.type === 'bs' ? 'B/S' : 'AG')}</span>
                </div>
                <p style="margin-bottom:12px">${escapeHtml(q.text)}</p>
                <div class="review-answer">
                    <p>Jawaban Anda: <span class="${isCorrect ? 'correct-text' : 'wrong-text'}">${escapeHtml(userAnswerText)}</span></p>
                    ${!isCorrect ? `<p>Jawaban Benar: <span class="correct-text">${escapeHtml(correctAnswerText)}</span></p>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    document.getElementById('reviewModal').classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}