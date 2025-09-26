// --- FUNCIONES UTILITARIAS REUTILIZABLES ---

export const getHoyYMD = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const formatNumber = (num) => {
    const number = parseFloat(num);
    if (isNaN(number)) return '0,00';
    return number.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const parseFormattedNumber = (str) => {
    if (typeof str !== 'string' || str.trim() === '') return 0;
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
};

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (container) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 4000);
    }
}

export const safeJSONParse = (key, defaultValue) => {
    try {
        const item = localStorage.getItem(key);
        const result = item ? JSON.parse(item) : defaultValue;
        return result || defaultValue;
    } catch (e) { console.error("Error parsing JSON:", e); return defaultValue; }
};

export const formatFechaCorta = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString('es-VE');
};

export const formatHora = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export function autoFormatNumberInput(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.addEventListener('blur', () => { if (input.value) input.value = formatNumber(parseFormattedNumber(input.value)); });
        input.addEventListener('focus', () => { const value = parseFormattedNumber(input.value); input.value = value !== 0 ? value : ''; });
    }
}

// --- LÓGICA DE CONFIRMACIÓN ---
const modalConfirmacion = document.getElementById('modal-confirmacion');
const confirmMessage = document.getElementById('confirm-message');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');

export function showConfirmationModal(message, onConfirm) {
    if (!modalConfirmacion || !confirmMessage || !confirmYesBtn || !confirmNoBtn) return;
    
    confirmMessage.textContent = message;
    modalConfirmacion.classList.add('active');

    const handleConfirm = () => {
        onConfirm();
        closeModal();
    };

    const handleCancel = () => {
        closeModal();
    };
    
    const closeModal = () => {
        modalConfirmacion.classList.remove('active');
        confirmYesBtn.removeEventListener('click', handleConfirm);
        confirmNoBtn.removeEventListener('click', handleCancel);
    }

    confirmYesBtn.addEventListener('click', handleConfirm);
    confirmNoBtn.addEventListener('click', handleCancel);
}