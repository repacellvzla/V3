import {
    getHoyYMD,
    showToast,
    safeJSONParse,
    autoFormatNumberInput,
    formatHora,
    formatFechaCorta,
    parseFormattedNumber,
    formatNumber,
    showConfirmationModal,
    generarPdfCierre
} from './utils.js';

import {
    renderizarKPIs,
    renderizarDeudas,
    renderizarTablaCuentas,
    renderizarTablaTransacciones,
    renderizarFees,
    renderizarCostosFijos,
    renderizarHistorialCierres,
    renderizarMetas,
    getRowDataForExport
} from './uiRender.js';

import { renderizarUsuarios, gestionarEventosUsuarios } from './userManagement.js';
import { inicializarGraficos, actualizarTodosLosGraficos } from './charts.js';


document.addEventListener('DOMContentLoaded', () => {
    try {
        let filtroActual = { tipo: 'hoy' }; 
        const usuarioLogeado = JSON.parse(localStorage.getItem('usuario-autenticado'));
        if (!usuarioLogeado) { window.location.href = 'index.html'; return; }

        // --- SELECTORES PRINCIPALES ---
        const debtList = document.getElementById('debt-list');
        const modalPago = document.getElementById('modal-pago-deuda');
        const closeModalBtn = modalPago ? modalPago.querySelector('.close-button') : null;
        const formPagoDeuda = document.getElementById('form-pago-deuda');
        const modalTitle = document.getElementById('modal-title');
        const deudaActualInfo = document.getElementById('deuda-actual-info');
        const montoPagoInput = document.getElementById('monto-pago');
        const deudaTransaccionIdInput = document.getElementById('deuda-transaccion-id');
        const fechaInicioInput = document.getElementById('fecha-inicio');
        const fechaFinInput = document.getElementById('fecha-fin');
        const settingsBtn = document.getElementById('settings-btn');
        const configModal = document.getElementById('modal-configuracion');
        const closeConfigBtn = document.getElementById('close-config-modal');
        const tablaCostosFijosBody = document.getElementById('tabla-costos-fijos')?.querySelector('tbody');
        const formMetas = document.getElementById('form-metas');
        const formGasto = document.getElementById('form-gasto');
        const utilidadesCard = document.getElementById('utilidades-card');
        const controlDiarioBtn = document.getElementById('control-diario-btn');
        const controlDiarioStatusDot = document.getElementById('control-diario-status-dot');
        const modalControlDiario = document.getElementById('modal-control-diario');
        const closeControlDiarioModalBtn = document.getElementById('close-control-diario-modal');
        const controlDiarioModalTitle = document.getElementById('control-diario-modal-title');
        const controlDiarioModalBody = document.getElementById('control-diario-modal-body');
        
        // --- FUNCIONES DE CÁLCULO (Lógica de Negocio) ---
        function calcularSaldos(bancos, transacciones) {
            if (!bancos) bancos = [];
            const saldos = bancos.map(banco => ({ ...banco, saldo: 0 }));
            transacciones.forEach(t => {
                const cuentaPropia = saldos.find(b => b.id === t.cuenta_propia_id);
                const custodiaUSD = saldos.find(b => b.id === 'Custodia $');
                if (t.tipo === 'Ingreso Saldo') { if (cuentaPropia) cuentaPropia.saldo += parseFloat(t.monto_ingreso); }
                else if (t.tipo === 'Venta') {
                    if (cuentaPropia && t.monto_ves) cuentaPropia.saldo += parseFloat(t.monto_ves);
                    if (custodiaUSD && t.monto_total_usd) custodiaUSD.saldo -= parseFloat(t.monto_total_usd);
                } else if (t.tipo === 'Compra') {
                    if (cuentaPropia && t.monto_ves) cuentaPropia.saldo -= parseFloat(t.monto_ves);
                    if (custodiaUSD && t.monto_entregado_usd) custodiaUSD.saldo += parseFloat(t.monto_entregado_usd);
                } else if (t.tipo === 'Transferencia Propia') {
                    const cuentaOrigen = saldos.find(b => b.id === t.cuenta_propia_id);
                    const cuentaDestino = saldos.find(b => b.id === t.cuenta_destino_id);
                    if (cuentaOrigen && cuentaDestino && t.monto_transferencia) {
                        cuentaOrigen.saldo -= parseFloat(t.monto_transferencia);
                        cuentaDestino.saldo += parseFloat(t.monto_transferencia);
                    }
                } else if (t.tipo === 'Pago Cliente') {
                    if (custodiaUSD && t.monto_pago_usd) custodiaUSD.saldo += parseFloat(t.monto_pago_usd);
                } else if (t.tipo === 'Gasto') {
                    const cuentaOrigenGasto = saldos.find(b => b.id === t.cuenta_origen_id);
                    if (cuentaOrigenGasto && t.monto_gasto) {
                        cuentaOrigenGasto.saldo -= parseFloat(t.monto_gasto);
                    }
                }
            });
            return saldos;
        }
        
        function calcularUtilidad(transaccionesFiltradas, todasLasCompras, costosFijos = []) {
            const ventasDelPeriodo = transaccionesFiltradas.filter(t => t.tipo === 'Venta');
            let utilidadBruta = 0;
            if (ventasDelPeriodo.length > 0 && todasLasCompras.length > 0) {
                let tasaPromedioCompra = 0;
                const totalBsInvertidoGlobal = todasLasCompras.reduce((sum, t) => sum + (parseFloat(t.monto_ves) || 0), 0);
                const totalUsdCompradoGlobal = todasLasCompras.reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0);
                if (totalUsdCompradoGlobal > 0) {
                    tasaPromedioCompra = totalBsInvertidoGlobal / totalUsdCompradoGlobal;
                }
                utilidadBruta = ventasDelPeriodo.reduce((sum, venta) => {
                    const gananciaPorDolar = (parseFloat(venta.tasa) || 0) - tasaPromedioCompra;
                    return sum + (gananciaPorDolar * (parseFloat(venta.monto_total_usd) || 0));
                }, 0);
            }
            const deliveryCostObject = costosFijos.find(c => c.nombre.toLowerCase() === 'delivery' && c.moneda === '$');
            const costoDeliveryUnitario = deliveryCostObject ? deliveryCostObject.monto : 0;
            const operacionesConDeliveryPeriodo = transaccionesFiltradas.filter(t => (t.tipo === 'Venta' || t.tipo === 'Compra') && t.delivery === true);
            const costoTotalDeliveryUSD = operacionesConDeliveryPeriodo.length * costoDeliveryUnitario;
            let tasaParaConversion = 0;
            if (todasLasCompras.length > 0) {
                 const totalBsInvertidoGlobal = todasLasCompras.reduce((sum, t) => sum + (parseFloat(t.monto_ves) || 0), 0);
                const totalUsdCompradoGlobal = todasLasCompras.reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0);
                if (totalUsdCompradoGlobal > 0) tasaParaConversion = totalBsInvertidoGlobal / totalUsdCompradoGlobal;
            } else if (ventasDelPeriodo.length > 0) {
                const totalBsVendido = ventasDelPeriodo.reduce((sum, t) => sum + (parseFloat(t.monto_ves) || 0), 0);
                const totalUsdVendido = ventasDelPeriodo.reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0);
                if (totalUsdVendido > 0) tasaParaConversion = totalBsVendido / totalUsdVendido;
            }
            const costoTotalDeliveryBs = costoTotalDeliveryUSD * tasaParaConversion;
            const utilidadNeta = utilidadBruta - costoTotalDeliveryBs;
            return utilidadNeta;
        }

        function filtrarTransacciones(transacciones, filtro) {
            if (!filtro || filtro.tipo === 'todos') return transacciones.slice();
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            return transacciones.filter(t => {
                const fechaT = new Date(t.fechaHora);
                fechaT.setHours(0, 0, 0, 0);
                switch (filtro.tipo) {
                    case 'hoy': return fechaT.getTime() === hoy.getTime();
                    case 'semana': 
                        const inicioSemana = new Date(hoy); 
                        inicioSemana.setDate(hoy.getDate() - hoy.getDay());
                        inicioSemana.setHours(0,0,0,0);
                        return fechaT >= inicioSemana;
                    case 'mes': 
                        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                        return fechaT >= inicioMes;
                    case 'rango': 
                        const inicio = new Date(filtro.inicio + 'T00:00:00'); 
                        const fin = new Date(filtro.fin + 'T23:59:59'); 
                        return new Date(t.fechaHora) >= inicio && new Date(t.fechaHora) <= fin;
                    default: return true;
                }
            });
        }

        function verificarEstadoJornada() {
            const controlActual = safeJSONParse('control_diario', null);
            const hoy = getHoyYMD(); // Usa la fecha local
            return controlActual && controlActual.fecha === hoy && controlActual.estado === 'abierto';
        }

        function actualizarBotonControlDiario() {
            if(!controlDiarioStatusDot) return;
            if (verificarEstadoJornada()) {
                controlDiarioStatusDot.classList.add('active');
            } else {
                controlDiarioStatusDot.classList.remove('active');
            }
        }

        function abrirModalControlDiario() {
            const jornadaAbierta = verificarEstadoJornada();
            
            if (jornadaAbierta) {
                const controlActual = safeJSONParse('control_diario');
                controlDiarioModalTitle.textContent = 'Jornada en Curso';
                
                let saldosHTML = '';
                if (controlActual.saldosIniciales) {
                    controlActual.saldosIniciales.forEach(cuenta => {
                        const simbolo = cuenta.id === 'Custodia $' ? '$' : 'Bs.';
                        saldosHTML += `<div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>${cuenta.nombre}</h5><p>${simbolo} ${formatNumber(cuenta.saldo)}</p></div></div>`;
                    });
                }

                controlDiarioModalBody.innerHTML = `
                    <p>Jornada iniciada el <strong>${formatFechaCorta(controlActual.inicioTimestamp)}</strong> a las <strong>${formatHora(controlActual.inicioTimestamp)}</strong>.</p>
                    <h5>Saldos Iniciales:</h5>
                    <div class="kpi-grid">${saldosHTML}</div>
                    <div class="button-container" style="margin-top: 20px;">
                        <button id="modal-cerrar-dia-btn" class="button button-danger">Realizar Cierre del Día</button>
                    </div>`;

            } else {
                controlDiarioModalTitle.textContent = 'Iniciar Jornada';
                controlDiarioModalBody.innerHTML = `
                    <p style="text-align: center;">No hay una jornada activa. Para poder registrar transacciones, debe iniciar el día.</p>
                    <div class="button-container" style="margin-top: 20px;">
                         <button id="modal-iniciar-dia-btn" class="button button-primary" style="width: 100%; padding: 15px; font-size: 1.2em;">Iniciar Día</button>
                    </div>`;
            }
            modalControlDiario.classList.add('active');
        }

        const cerrarJornada = () => {
             showConfirmationModal('¿Estás seguro de que deseas cerrar la jornada? Esta acción es definitiva.', () => {
                const controlActual = safeJSONParse('control_diario', null);
                if (!controlActual || controlActual.estado !== 'abierto') {
                    showToast('No hay una jornada activa para cerrar.', 'error');
                    return;
                }
                const transacciones = safeJSONParse('transacciones', []);
                const config = safeJSONParse('configuracion', { bancos: [] });
                const saldosFinales = calcularSaldos(config.bancos, transacciones);
                const transaccionesDelDia = transacciones.filter(t => new Date(t.fechaHora) >= new Date(controlActual.inicioTimestamp));
                const resumen = {
                    ventas: transaccionesDelDia.filter(t => t.tipo === 'Venta').reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0),
                    compras: transaccionesDelDia.filter(t => t.tipo === 'Compra').reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0),
                    gastos: transaccionesDelDia.filter(t => t.tipo === 'Gasto').reduce((sum, t) => sum + (parseFloat(t.monto_gasto) || 0), 0),
                    deliveries: transaccionesDelDia.filter(t => t.delivery === true).length,
                    utilidad: calcularUtilidad(transaccionesDelDia, transacciones.filter(t => t.tipo === 'Compra'), config.costos_fijos)
                };
                controlActual.estado = 'cerrado';
                controlActual.cierreTimestamp = new Date().toISOString();
                controlActual.saldosFinales = saldosFinales;
                controlActual.resumen = resumen;
                let historialCierres = safeJSONParse('historial_cierres', []);
                historialCierres.push(controlActual);
                localStorage.setItem('historial_cierres', JSON.stringify(historialCierres));
                localStorage.setItem('control_diario', JSON.stringify(controlActual));
                showToast(`Jornada del ${formatFechaCorta(controlActual.fecha)} cerrada exitosamente.`, 'success');
                recalcularYRenderizarTodo();
            });
        };

        // --- FUNCIÓN ORQUESTADORA PRINCIPAL ---
        function recalcularYRenderizarTodo() {
            const defaultConfig = { bancos: [], costos_fijos: [], fees: {}, metas: {} };
            const config = safeJSONParse('configuracion', defaultConfig);
            const transacciones = safeJSONParse('transacciones', []);
            const transaccionesFiltradas = filtrarTransacciones(transacciones, filtroActual);
            const saldosActualizados = calcularSaldos(config.bancos, transacciones);
            localStorage.setItem('saldos_actuales', JSON.stringify(saldosActualizados));
            
            renderizarKPIs(saldosActualizados, transacciones, calcularUtilidad); 
            renderizarDeudas(transacciones);
            renderizarTablaCuentas(saldosActualizados); 
            renderizarTablaTransacciones(transaccionesFiltradas);
            
            const DEFAULT_METAS = { ventas: 5000, compras: 7000, gastos: 1000000, deliveries: 10, utilidad: 2000000 };
            const metas = config.metas && Object.keys(config.metas).length ? config.metas : DEFAULT_METAS;
            const todasLasCompras = transacciones.filter(t => t.tipo === 'Compra');
            const utilidad = calcularUtilidad(transaccionesFiltradas, todasLasCompras, config.costos_fijos);
            const metricasGraficos = {
                ventas: transaccionesFiltradas.filter(t => t.tipo === 'Venta').reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0),
                compras: transaccionesFiltradas.filter(t => t.tipo === 'Compra').reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0),
                gastos: transaccionesFiltradas.filter(t => t.tipo === 'Gasto').reduce((sum, t) => sum + (parseFloat(t.monto_gasto) || 0), 0),
                deliveries: transaccionesFiltradas.filter(t => t.delivery === true).length,
                utilidad: utilidad,
                metas: metas
            };
            actualizarTodosLosGraficos(metricasGraficos);
            
            document.querySelectorAll('.button-filtro').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filtro === filtroActual.tipo);
            });

            renderizarFees();
            renderizarCostosFijos();
            renderizarMetas();
            actualizarBotonControlDiario();

            const jornadaAbierta = verificarEstadoJornada();
            document.querySelector('#form-add-cuenta button[type="submit"]').disabled = !jornadaAbierta;
            document.querySelector('#form-transferencia button[type="submit"]').disabled = !jornadaAbierta;
            document.querySelector('#form-gasto button[type="submit"]').disabled = !jornadaAbierta;
        }

        // --- BLOQUE COMPLETO DE MANEJADORES DE EVENTOS ---
        
        // Control Diario
        if (controlDiarioBtn) { controlDiarioBtn.addEventListener('click', abrirModalControlDiario); }
        if (closeControlDiarioModalBtn) { closeControlDiarioModalBtn.addEventListener('click', () => modalControlDiario.classList.remove('active')); }
        if (modalControlDiario) {
            modalControlDiario.addEventListener('click', (e) => {
                if (e.target.id === 'modal-iniciar-dia-btn') {
                    const transacciones = safeJSONParse('transacciones', []);
                    const config = safeJSONParse('configuracion', { bancos: [] });
                    const saldosActuales = calcularSaldos(config.bancos, transacciones);
                    const nuevoControl = { fecha: getHoyYMD(), estado: 'abierto', inicioTimestamp: new Date().toISOString(), saldosIniciales: saldosActuales, cierreTimestamp: null, saldosFinales: null, resumen: null };
                    localStorage.setItem('control_diario', JSON.stringify(nuevoControl));
                    showToast('¡Jornada iniciada exitosamente!', 'success');
                    modalControlDiario.classList.remove('active');
                    recalcularYRenderizarTodo();
                }
                if (e.target.id === 'modal-cerrar-dia-btn') {
                    cerrarJornada();
                    modalControlDiario.classList.remove('active');
                }
            });
        }

        // Exportar
        document.getElementById('export-excel-btn').addEventListener('click', () => {
            const transacciones = filtrarTransacciones(safeJSONParse('transacciones', []), filtroActual);
            let data = [["Fecha", "Hora", "Operacion", "Cliente", "Tasa", "Monto", "Banco", "Saldo Pendiente", "Estatus", "Observacion"]];
            transacciones.forEach(t => data.push(getRowDataForExport(t)));
            const csvContent = "data:text/csv;charset=utf-8," + data.map(e => e.join(";")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Reporte.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        document.getElementById('export-pdf-btn').addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            const transacciones = filtrarTransacciones(safeJSONParse('transacciones', []), filtroActual);
            let data = transacciones.map(t => getRowDataForExport(t));
            const tableHeaders = ["Fecha", "Hora", "Operación", "Cliente", "Tasa", "Monto", "Banco", "Saldo Pendiente", "Estatus", "Observación"];
            doc.text("Historial de Transacciones", 14, 20);
            doc.autoTable({ head: [tableHeaders], body: data, startY: 30, styles: { fontSize: 7, cellPadding: 2, halign: 'center' }, headStyles: { fillColor: [0, 128, 128], textColor: [255, 255, 255], halign: 'center' } });
            doc.save(`Reporte.pdf`);
        });

        // Pago de Deudas
        if (debtList) {
            debtList.addEventListener('click', (e) => {
                if (e.target.classList.contains('pagar-deuda-btn')) {
                    const transaccionId = e.target.dataset.id;
                    const transacciones = safeJSONParse('transacciones', []);
                    const deuda = transacciones.find(t => t.id == transaccionId);
                    if (deuda) {
                        modalTitle.textContent = `Registrar Abono de ${deuda.cliente}`;
                        deudaActualInfo.textContent = `$${formatNumber(deuda.saldo_pendiente_usd)}`;
                        montoPagoInput.value = deuda.saldo_pendiente_usd.toFixed(2);
                        deudaTransaccionIdInput.value = transaccionId;
                        modalPago.classList.add('active');
                    }
                }
            });
        }
        if (formPagoDeuda) {
            formPagoDeuda.addEventListener('submit', (e) => {
                e.preventDefault();
                const transaccionId = deudaTransaccionIdInput.value;
                const montoPagado = parseFloat(montoPagoInput.value);
                if (!transaccionId || isNaN(montoPagado) || montoPagado <= 0) { showToast('Monto inválido.', 'error'); return; }
                let transacciones = safeJSONParse('transacciones', []);
                const transaccionOriginal = transacciones.find(t => t.id == transaccionId);
                if (transaccionOriginal && montoPagado <= transaccionOriginal.saldo_pendiente_usd + 0.001) {
                    transaccionOriginal.saldo_pendiente_usd -= montoPagado;
                    if (transaccionOriginal.saldo_pendiente_usd < 0.01) {
                        transaccionOriginal.saldo_pendiente_usd = 0;
                        transaccionOriginal.estatus = 'Entregado';
                    }
                    transacciones.push({ id: Date.now(), tipo: 'Pago Cliente', cliente: transaccionOriginal.cliente, monto_pago_usd: montoPagado, fechaHora: new Date().toISOString(), id_transaccion_original: transaccionId, estatus: 'Pagado' });
                    localStorage.setItem('transacciones', JSON.stringify(transacciones));
                    showToast('¡Pago registrado exitosamente!', 'success');
                    modalPago.classList.remove('active');
                    recalcularYRenderizarTodo();
                } else {
                    showToast('El monto del pago no puede ser mayor que la deuda.', 'error');
                }
            });
        }
        if (closeModalBtn) { closeModalBtn.addEventListener('click', () => modalPago.classList.remove('active')); }
        if (modalPago) { modalPago.addEventListener('click', (e) => { if (e.target === modalPago) modalPago.classList.remove('active'); }); }
        
        // Pestañas (Tabs)
        document.querySelectorAll('.card .tabs .tab-link').forEach(link => {
             link.addEventListener('click', (e) => {
                const parentCard = e.target.closest('.card');
                parentCard.querySelectorAll('.tabs .tab-link, .tab-content').forEach(el => el.classList.remove('active'));
                e.target.classList.add('active');
                const tabContentId = e.target.dataset.tab;
                if(tabContentId) {
                    parentCard.querySelector(`#${tabContentId}`).classList.add('active');
                    if (tabContentId === 'tab-historial') {
                        renderizarHistorialCierres();
                    }
                }
            });
        });

        document.querySelectorAll('#modal-configuracion .tabs .tab-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const parentModal = e.target.closest('.modal-content');
                parentModal.querySelectorAll('.tabs .tab-link, .tab-content').forEach(el => el.classList.remove('active'));
                e.target.classList.add('active');
                const tabContentId = e.target.dataset.tabContent;
                if(tabContentId) {
                    parentModal.querySelector(`#${tabContentId}`).classList.add('active');
                    if (tabContentId === 'tab-usuarios') { 
                        renderizarUsuarios(usuarioLogeado); 
                    }
                    if (tabContentId === 'tab-historial') { 
                        renderizarHistorialCierres();
                    }
                }
            });
        });

        // Formularios
        document.getElementById('form-add-cuenta').addEventListener('submit', (e) => {
            e.preventDefault();
            const idCuenta = document.getElementById('nombre-cuenta-select').value;
            const saldoAingresar = parseFormattedNumber(document.getElementById('saldo-cuenta').value);
            const concepto = document.getElementById('saldo-concepto').value;
            if (!idCuenta || (isNaN(saldoAingresar) || saldoAingresar === 0)) { showToast('Seleccione cuenta e ingrese un saldo válido.','error'); return; }
            let transacciones = safeJSONParse('transacciones', []);
            transacciones.push({ id: Date.now(), tipo: 'Ingreso Saldo', cuenta_propia_id: idCuenta, monto_ingreso: saldoAingresar, fechaHora: new Date().toISOString(), estatus: 'Completado', concepto: concepto });
            localStorage.setItem('transacciones', JSON.stringify(transacciones));
            showToast('Saldo ingresado correctamente.', 'success');
            e.target.reset();
            recalcularYRenderizarTodo();
        });

        document.getElementById('form-transferencia').addEventListener('submit', (e) => {
             e.preventDefault();
            const origenId = document.getElementById('cuenta-origen').value;
            const destinoId = document.getElementById('cuenta-destino').value;
            const monto = parseFormattedNumber(document.getElementById('monto-transferencia').value);
            const concepto = document.getElementById('transferencia-concepto').value;
            if (!origenId || !destinoId || !monto || monto <= 0) { showToast('Los campos Desde, Hacia y Monto son obligatorios.', 'error'); return; }
            if (origenId === destinoId) { showToast('Las cuentas no pueden ser la misma.', 'error'); return; }
            let transacciones = safeJSONParse('transacciones', []);
            const config = safeJSONParse('configuracion', {});
            const saldosActuales = calcularSaldos(config.bancos, transacciones);
            const cuentaOrigen = saldosActuales.find(b => b.id === origenId);
            if (!cuentaOrigen || cuentaOrigen.saldo < monto) { showToast('Saldo insuficiente en la cuenta de origen.', 'error'); return; }
            transacciones.push({ id: Date.now(), tipo: 'Transferencia Propia', cuenta_propia_id: origenId, cuenta_destino_id: destinoId, monto_transferencia: monto, fechaHora: new Date().toISOString(), estatus: 'Completado', concepto: concepto });
            localStorage.setItem('transacciones', JSON.stringify(transacciones));
            showToast('Transferencia registrada exitosamente.', 'success');
            e.target.reset();
            recalcularYRenderizarTodo();
        });

        if (formGasto) {
            formGasto.addEventListener('submit', (e) => {
                e.preventDefault();
                const cuentaOrigenId = document.getElementById('gasto-cuenta-origen').value;
                const monto = parseFormattedNumber(document.getElementById('gasto-monto').value);
                const concepto = document.getElementById('gasto-concepto').value;
                if (!cuentaOrigenId || !monto || monto <= 0 || !concepto) { showToast('Todos los campos son obligatorios.', 'error'); return; }
                let transacciones = safeJSONParse('transacciones', []);
                const config = safeJSONParse('configuracion', {});
                const saldosActuales = calcularSaldos(config.bancos, transacciones);
                const cuentaOrigen = saldosActuales.find(b => b.id === cuentaOrigenId);
                if (!cuentaOrigen || cuentaOrigen.saldo < monto) { showToast('Saldo insuficiente en la cuenta de origen.', 'error'); return; }
                transacciones.push({ id: Date.now(), tipo: 'Gasto', cuenta_origen_id: cuentaOrigenId, monto_gasto: monto, concepto: concepto, fechaHora: new Date().toISOString(), estatus: 'Completado' });
                localStorage.setItem('transacciones', JSON.stringify(transacciones));
                showToast('Gasto registrado exitosamente.', 'success');
                e.target.reset();
                recalcularYRenderizarTodo();
            });
        }
        
        if (formMetas) {
            formMetas.addEventListener('submit', (e) => {
                e.preventDefault();
                const nuevasMetas = {
                    ventas: parseFormattedNumber(document.getElementById('meta-ventas').value),
                    compras: parseFormattedNumber(document.getElementById('meta-compras').value),
                    gastos: parseFormattedNumber(document.getElementById('meta-gastos').value),
                    utilidad: parseFormattedNumber(document.getElementById('meta-utilidad').value),
                    deliveries: parseInt(document.getElementById('meta-deliveries').value, 10) || 0,
                };
                let config = safeJSONParse('configuracion', {});
                config.metas = nuevasMetas;
                localStorage.setItem('configuracion', JSON.stringify(config));
                showToast('Metas guardadas exitosamente.', 'success');
                configModal.classList.remove('active');
                recalcularYRenderizarTodo();
            });
        }
        
        // Filtros
        document.querySelectorAll('.button-filtro').forEach(btn => {
            btn.addEventListener('click', () => {
                filtroActual = { tipo: btn.dataset.filtro };
                if(fechaInicioInput) fechaInicioInput.value = ''; 
                if(fechaFinInput) fechaFinInput.value = '';
                recalcularYRenderizarTodo();
            });
        });

        document.getElementById('filtrar-rango-btn').addEventListener('click', () => {
            const inicio = fechaInicioInput.value;
            const fin = fechaFinInput.value;
            if (!inicio || !fin) { showToast('Debe seleccionar ambas fechas.', 'error'); return; }
            filtroActual = { tipo: 'rango', inicio: inicio, fin: fin };
            recalcularYRenderizarTodo();
        });

        document.getElementById('limpiar-filtros-btn').addEventListener('click', () => {
            filtroActual = { tipo: 'todos' };
            if(fechaInicioInput) fechaInicioInput.value = ''; 
            if(fechaFinInput) fechaFinInput.value = '';
            recalcularYRenderizarTodo();
        });

        // Navegación y Modales
        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('usuario-autenticado');
            window.location.href = 'index.html';
        });

        if (settingsBtn) { 
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                configModal.classList.add('active');
                renderizarFees();
                renderizarCostosFijos();
                renderizarMetas();
                renderizarHistorialCierres();
            }); 
        }

        if (closeConfigBtn) {
            closeConfigBtn.addEventListener('click', () => configModal.classList.remove('active'));
        }

        if (utilidadesCard) {
            utilidadesCard.addEventListener('click', (e) => {
                if (e.target.classList.contains('ver-detalles-cierre-btn')) {
                    const header = e.target.closest('.cierre-header');
                    const details = header.nextElementSibling;
                    const timestamp = header.dataset.timestamp;
                    const historial = safeJSONParse('historial_cierres', []);
                    const cierre = historial.find(c => c.inicioTimestamp === timestamp);

                    if (details.style.display === 'block') {
                        details.style.display = 'none';
                        e.target.textContent = 'Ver Detalles';
                    } else if (cierre) {
                        let saldosInicialesHTML = '';
                        cierre.saldosIniciales.forEach(c => saldosInicialesHTML += `<li>${c.nombre}: ${c.id === 'Custodia $' ? '$' : 'Bs.'} ${formatNumber(c.saldo)}</li>`);
                        let saldosFinalesHTML = '';
                        cierre.saldosFinales.forEach(c => saldosFinalesHTML += `<li>${c.nombre}: ${c.id === 'Custodia $' ? '$' : 'Bs.'} ${formatNumber(c.saldo)}</li>`);

                        details.innerHTML = `
                            <h5>Saldos Iniciales</h5><ul>${saldosInicialesHTML}</ul>
                            <h5>Resumen de Operaciones</h5>
                            <ul>
                                <li>Ventas Totales: $${formatNumber(cierre.resumen.ventas)}</li>
                                <li>Compras Totales: $${formatNumber(cierre.resumen.compras)}</li>
                                <li>Gastos Totales: Bs. ${formatNumber(cierre.resumen.gastos)}</li>
                                <li>Utilidad Neta: Bs. ${formatNumber(cierre.resumen.utilidad)}</li>
                                <li>Nº de Deliveries: ${cierre.resumen.deliveries}</li>
                            </ul>
                            <h5>Saldos Finales</h5><ul>${saldosFinalesHTML}</ul>`;
                        details.style.display = 'block';
                        e.target.textContent = 'Ocultar Detalles';
                    }
                }

                if (e.target.classList.contains('descargar-cierre-btn')) {
                    const header = e.target.closest('.cierre-header');
                    const timestamp = header.dataset.timestamp;
                    const historial = safeJSONParse('historial_cierres', []);
                    const cierre = historial.find(c => c.inicioTimestamp === timestamp);
                    if(cierre) generarPdfCierre(cierre);
                }
            });
        }
        
        // --- INICIALIZACIÓN ---
        autoFormatNumberInput('saldo-cuenta');
        autoFormatNumberInput('monto-transferencia');
        autoFormatNumberInput('gasto-monto');
        autoFormatNumberInput('costo-fijo-monto');
        autoFormatNumberInput('meta-ventas');
        autoFormatNumberInput('meta-compras');
        autoFormatNumberInput('meta-gastos');
        autoFormatNumberInput('meta-utilidad');
        
        gestionarEventosUsuarios(usuarioLogeado);
        
        inicializarGraficos();
        recalcularYRenderizarTodo();

    } catch (error) {
        console.error("Error fatal al iniciar el dashboard:", error);
        showToast("Ha ocurrido un error grave.", 'error');
    }
});