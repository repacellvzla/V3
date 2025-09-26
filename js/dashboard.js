import {
    getHoyYMD,
    showToast,
    safeJSONParse,
    autoFormatNumberInput,
    formatHora,
    formatFechaCorta,
    parseFormattedNumber,
    formatNumber
} from './utils.js';

import {
    renderizarKPIs,
    renderizarDeudas,
    renderizarTablaCuentas,
    renderizarTablaTransacciones,
    renderizarFees,
    renderizarCostosFijos,
    renderizarHistorialCierres,
    renderizarMetas
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
        
        // --- MANEJADORES DE EVENTOS ---
        function verificarEstadoJornada() {
            const controlActual = safeJSONParse('control_diario', null);
            const hoy = getHoyYMD();
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
             if (!confirm('¿Estás seguro de que deseas cerrar la jornada? Esta acción es definitiva.')) { return; }
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
        };

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
        
        // --- (El resto de los event listeners que no fueron movidos, como el de exportar, etc. irían aquí) ---
        
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