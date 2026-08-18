// ==========================================
// PUBLIC LEADERBOARD
// ==========================================

document.addEventListener('DOMContentLoaded', loadLeaderboard);

async function loadLeaderboard() {
    const params = new URLSearchParams(window.location.search);
    const quizId = params.get('id');

    if (!quizId) {
        document.getElementById('leaderboard').innerHTML = '<div class="empty-state"><p>Kuis tidak ditemukan.</p></div>';
        return;
    }

    try {
        const quizDoc = await db.collection('quizzes').doc(quizId).get();
        if (!quizDoc.exists) {
            document.getElementById('leaderboard').innerHTML = '<div class="empty-state"><p>Kuis tidak ditemukan.</p></div>';
            return;
        }

        const quizData = quizDoc.data();
        document.getElementById('hasilTitle').textContent = `Peringkat: ${quizData.title}`;
        document.getElementById('hasilSubtitle').textContent = `${quizData.subject} | Kode: ${quizData.code}`;

        const snap = await db.collection('results')
            .where('quizId', '==', quizId)
            .orderBy('score', 'desc')
            .get();

        if (snap.empty) {
            document.getElementById('leaderboard').innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Belum ada peserta.</p></div>';
            return;
        }

        let html = '';
        let rank = 1;

        snap.forEach(doc => {
            const d = doc.data();
            const topClass = rank === 1 ? 'top-1' : (rank === 2 ? 'top-2' : (rank === 3 ? 'top-3' : ''));
            const rankIcon = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : rank));
            const rankColorClass = rank === 1 ? 'gold' : (rank === 2 ? 'silver' : (rank === 3 ? 'bronze' : ''));

            const scoreColor = d.score >= 80 ? 'var(--success)' : (d.score >= 60 ? 'var(--warning)' : 'var(--danger)');

            html += `
                <div class="leaderboard-item ${topClass}">
                    <div class="lb-rank ${rankColorClass}">${rankIcon}</div>
                    <div class="lb-info">
                        <div class="lb-name">${escapeHtml(d.studentName || '-')}</div>
                        <div class="lb-detail">${escapeHtml(d.studentClass || '')} ${d.studentId ? '• ' + escapeHtml(d.studentId) : ''} • ${d.timeSpent || '-'}</div>
                    </div>
                    <div class="lb-score" style="color:${scoreColor}">${d.score}</div>
                </div>
            `;
            rank++;
        });

        document.getElementById('leaderboard').innerHTML = html;

    } catch (e) {
        console.error('Leaderboard error:', e);
        document.getElementById('leaderboard').innerHTML = '<div class="empty-state"><p>Gagal memuat data.</p></div>';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}