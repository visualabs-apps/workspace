const ERROR_MAP = {
    '-1': { title: 'Gagal Memuat', icon: '⚠️', description: 'Terjadi kesalahan yang tidak diketahui saat memuat halaman.' },
    '-2': { title: 'Gagal Memuat', icon: '⚠️', description: 'Permintaan dibatalkan.' },
    '-3': { title: 'Koneksi Gagal', icon: '🔌', description: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' },
    '-6': { title: 'File Tidak Ditemukan', icon: '📄', description: 'File yang diminta tidak ditemukan di server.' },
    '-7': { title: 'Timeout', icon: '⏱️', description: 'Server membutuhkan waktu terlalu lama untuk merespons.' },
    '-10': { title: 'Akses Ditolak', icon: '🚫', description: 'Anda tidak memiliki izin untuk mengakses halaman ini.' },
    '-21': { title: 'Akses Ditolak', icon: '🔒', description: 'Akses ke jaringan ditolak.' },

    '-100': { title: 'Koneksi Gagal', icon: '🔌', description: 'Koneksi terputus secara tidak terduga.' },
    '-101': { title: 'Koneksi Ditolak', icon: '🔌', description: 'Server menolak koneksi. Server mungkin sedang tidak aktif atau port salah.' },
    '-102': { title: 'Koneksi Ditolak', icon: '🔌', description: 'Server menolak koneksi. Pastikan server sedang berjalan.' },
    '-105': { title: 'DNS Error', icon: '🌐', description: 'Tidak dapat menemukan alamat server. Nama domain mungkin salah atau DNS tidak dapat dijangkau.' },
    '-106': { title: 'Internet Terputus', icon: '📡', description: 'Tidak ada koneksi internet. Periksa kabel jaringan, modem, atau router Anda.' },
    '-107': { title: 'SSL Error', icon: '🔒', description: 'Protokol SSL tidak valid. Server mungkin memerlukan konfigurasi keamanan yang berbeda.' },
    '-108': { title: 'Koneksi Gagal', icon: '🔌', description: 'Alamat koneksi sedang digunakan.' },
    '-109': { title: 'Koneksi Gagal', icon: '🔌', description: 'Koneksi sedang berlangsung.' },
    '-110': { title: 'Koneksi Gagal', icon: '🔌', description: 'Koneksi ditolak karena aturan jaringan.' },
    '-111': { title: 'Koneksi Gagal', icon: '🔌', description: 'Koneksi gagal karena batas waktu habis.' },
    '-112': { title: 'Host Tidak Ditemukan', icon: '🌐', description: 'Nama host tidak ditemukan. Periksa ejaan URL.' },
    '-118': { title: 'Koneksi Timeout', icon: '⏱️', description: 'Server membutuhkan waktu terlalu lama untuk merespons. Coba lagi nanti.' },
    '-123': { title: 'Server Error', icon: '🖥️', description: 'Server mengembalikan respons yang tidak valid.' },
    '-124': { title: 'Server Error', icon: '🖥️', description: 'Koneksi gagal karena respons yang tidak valid.' },
    '-129': { title: 'Registrasi Jaringan', icon: '📡', description: 'Jaringan tidak terdaftar.' },
    '-130': { title: 'Proxy Error', icon: '🔀', description: 'Proxy memerlukan autentikasi.' },
    '-131': { title: 'Proxy Error', icon: '🔀', description: 'Tidak dapat terhubung ke server proxy.' },
    '-133': { title: 'Proxy Error', icon: '🔀', description: 'Proxy tidak dapat menyelesaikan nama host.' },
    '-136': { title: 'Koneksi Gagal', icon: '🔌', description: 'Koneksi ditutup oleh server.' },
    '-137': { title: 'Koneksi Gagal', icon: '🔌', description: 'Koneksi di-reset oleh server.' },
    '-138': { title: 'Koneksi Gagal', icon: '🔌', description: 'Koneksi di-interupt.' },
    '-139': { title: 'Koneksi Gagal', icon: '🔌', description: 'Koneksi ditutup karena batas waktu.' },
    '-140': { title: 'TLS Error', icon: '🔒', description: 'Handshake TLS gagal. Server mungkin menggunakan protokol keamanan yang tidak didukung.' },
    '-141': { title: 'TLS Error', icon: '🔒', description: 'Protokol TLS yang diminta tidak didukung.' },
    '-142': { title: 'TLS Error', icon: '🔒', description: 'Sertifikat TLS tidak valid.' },
    '-147': { title: 'SSL Error', icon: '🔒', description: 'Versi SSL tidak didukung oleh server.' },
    '-150': { title: 'SSL Error', icon: '🔒', description: 'Handshake SSL gagal. Sertifikat server mungkin tidak valid.' },
    '-200': { title: 'Sertifikat Tidak Valid', icon: '🔒', description: 'Nama domain sertifikat tidak cocok dengan URL yang diminta.' },
    '-201': { title: 'Sertifikat Kadaluarsa', icon: '🔒', description: 'Sertifikat keamanan situs telah kadaluarsa.' },
    '-202': { title: 'Sertifikat Tidak Terpercaya', icon: '🔒', description: 'Sertifikat keamanan diterbitkan oleh otoritas yang tidak dikenal.' },
    '-203': { title: 'Sertifikat Error', icon: '🔒', description: 'Sertifikat mengandung kesalahan.' },
    '-204': { title: 'Sertifikat Error', icon: '🔒', description: 'Revokasi sertifikat tidak diketahui.' },
    '-205': { title: 'Sertifikat Error', icon: '🔒', description: 'Tidak dapat memeriksa revokasi sertifikat.' },
    '-206': { title: 'Sertifikat Error', icon: '🔒', description: 'Sertifikat telah dicabut.' },
    '-207': { title: 'Sertifikat Tidak Valid', icon: '🔒', description: 'Nama domain dalam sertifikat tidak cocok.' },
    '-208': { title: 'Sertifikat Error', icon: '🔒', description: 'Sertifikat bersifat transparan.' },
    '-209': { title: 'Sertifikat Error', icon: '🔒', description: 'Terlalu banyak redirect dengan sertifikat yang salah.' },
    '-210': { title: 'Sertifikat Tidak Valid', icon: '🔒', description: 'Sertifikat bersifat tidak transparan.' },
    '-211': { title: 'Sertifikat Error', icon: '🔒', description: 'Transparansi sertifikat diperlukan.' },
    '-212': { title: 'Sertifikat Error', icon: '🔒', description: 'Sertifikat dikenakan batasan yang melarang penggunaan untuk situs ini.' },
    '-213': { title: 'Sertifikat Error', icon: '🔒', description: 'Validasi sertifikat gagal karena alasan yang tidak diketahui.' },
    '-300': { title: 'Server Error', icon: '🖥️', description: 'Server mengembalikan kesalahan internal (500).' },
    '-301': { title: 'Server Error', icon: '🖥️', description: 'Server mengembalikan kesalahan gateway yang buruk (502).' },
    '-302': { title: 'Server Error', icon: '🖥️', description: 'Server mengembalikan kesalahan layanan tidak tersedia (503).' },
    '-310': { title: 'Terlalu Banyak Redirect', icon: '🔄', description: 'Halaman melakukan terlalu banyak redirect. Hapus cookie atau coba lagi nanti.' },
    '-311': { title: 'Konten Terlalu Besar', icon: '📦', description: 'Respons dari server terlalu besar untuk diproses.' },
    '-312': { title: 'Download Error', icon: '📥', description: 'Gagal mengunduh file dari server.' },
    '-313': { title: 'Upload Error', icon: '📤', description: 'Gagal mengunggah file ke server.' },
    '-324': { title: 'Koneksi Gagal', icon: '🔌', description: 'Koneksi ditutup secara tidak terduga selama transfer data.' },
    '-501': { title: 'Cache Error', icon: '💾', description: 'Tidak dapat membaca data dari cache.' },
};

const CRASH_ERROR = { title: 'Halaman Crash', icon: '💥', description: 'Proses render halaman mengalami crash. Coba muat ulang halaman.' };
const UNRESPONSIVE_ERROR = { title: 'Halaman Tidak Responsif', icon: '⏳', description: 'Halaman tidak merespons. Mungkin terdapat script yang berjalan terlalu lama.' };

export function getErrorInfo(errorCode) {
    const code = String(errorCode);
    return ERROR_MAP[code] || { title: 'Gagal Memuat', icon: '⚠️', description: `Terjadi kesalahan saat memuat halaman (kode: ${code}).` };
}

export function getCrashError() {
    return CRASH_ERROR;
}

export function getUnresponsiveError() {
    return UNRESPONSIVE_ERROR;
}
