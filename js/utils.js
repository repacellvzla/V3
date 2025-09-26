// --- FUNCIONES UTILITARIAS REUTILIZABLES ---

export const getHoyYMD = () => {
    const now = new Date(); // Crea una fecha basada en la hora local del navegador
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // Devuelve la fecha local, ej: "2025-09-26"
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

export function generarPdfCierre(cierre) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(`Reporte de Cierre de Jornada`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha: ${formatFechaCorta(cierre.fecha)}`, 14, 32);

    doc.autoTable({
        startY: 40,
        head: [['Detalle', 'Valor']],
        body: [
            ['Hora de Inicio', formatHora(cierre.inicioTimestamp)],
            ['Hora de Cierre', formatHora(cierre.cierreTimestamp)],
            ['---', '---'],
            ['Ventas Totales', `$ ${formatNumber(cierre.resumen.ventas)}`],
            ['Compras Totales', `$ ${formatNumber(cierre.resumen.compras)}`],
            ['Gastos Totales', `Bs. ${formatNumber(cierre.resumen.gastos)}`],
            ['Utilidad Neta', `Bs. ${formatNumber(cierre.resumen.utilidad)}`],
            ['Nº de Deliveries', `${cierre.resumen.deliveries}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 128, 128] }
    });

    const lastY = doc.autoTable.previous.finalY;

    doc.autoTable({
        startY: lastY + 10,
        head: [['Saldos Iniciales', '']],
        body: cierre.saldosIniciales.map(c => [c.nombre, `${c.id === 'Custodia $' ? '$' : 'Bs.'} ${formatNumber(c.saldo)}`]),
        theme: 'grid',
        headStyles: { fillColor: [0, 128, 128] }
    });
    
     doc.autoTable({
        startY: doc.autoTable.previous.finalY + 10,
        head: [['Saldos Finales', '']],
        body: cierre.saldosFinales.map(c => [c.nombre, `${c.id === 'Custodia $' ? '$' : 'Bs.'} ${formatNumber(c.saldo)}`]),
        theme: 'grid',
        headStyles: { fillColor: [0, 128, 128] }
    });

    doc.save(`Cierre_de_Jornada_${cierre.fecha}.pdf`);
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
        modalConfirmacion.removeEventListener('click', handleOutsideClick);
    }

    const handleOutsideClick = (e) => {
        if (e.target === modalConfirmacion) {
            closeModal();
        }
    }

    confirmYesBtn.addEventListener('click', handleConfirm);
    confirmNoBtn.addEventListener('click', handleCancel);
    modalConfirmacion.addEventListener('click', handleOutsideClick);
}