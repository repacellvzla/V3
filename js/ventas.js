import { formatNumber, parseFormattedNumber, showToast, getHoyYMD } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    try {
        const usuarioLogeado = JSON.parse(localStorage.getItem('usuario-autenticado'));
        if (!usuarioLogeado) { window.location.href = 'index.html'; return; }

        if (usuarioLogeado.rol === 'administrador' || usuarioLogeado.rol === 'supervisor') {
            const dashboardBtn = document.getElementById('dashboard-btn');
            if (dashboardBtn) dashboardBtn.style.display = 'inline-block';
        }

        const controlActual = JSON.parse(localStorage.getItem('control_diario')) || null;
        const hoy = getHoyYMD();
        const jornadaAnteriorAbierta = controlActual && controlActual.estado === 'abierto' && controlActual.fecha !== hoy;
        const jornadaAbierta = controlActual && controlActual.fecha === hoy && controlActual.estado === 'abierto';
        
        const submitBtn = document.getElementById('submit-btn');
        const alertaJornada = document.getElementById('alerta-jornada-cerrada');

        if (!jornadaAbierta) {
            if (submitBtn) submitBtn.disabled = true;
            if (alertaJornada) {
                if(jornadaAnteriorAbierta) {
                    const fechaAnterior = new Date(controlActual.fecha + 'T00:00:00').toLocaleDateString('es-VE');
                    alertaJornada.textContent = `La jornada del día ${fechaAnterior} no ha sido cerrada. No se pueden registrar transacciones.`;
                }
                alertaJornada.style.display = 'block';
            }
        }

        const saldosActuales = JSON.parse(localStorage.getItem('saldos_actuales')) || [];
        const transaccionForm = document.getElementById('transaccion-form');
        const tipoOperacionSelect = document.getElementById('tipo-operacion');
        const clienteInput = document.getElementById('cliente');
        const telefonoInput = document.getElementById('telefono');
        const usdOperarInput = document.getElementById('usd-operar');
        const usdEntregadosInput = document.getElementById('usd-entregados');
        const tasaClienteInput = document.getElementById('tasa-cliente');
        const cuentaEmisorSelect = document.getElementById('cuenta-emisor');
        const cuentaReceptorSelect = document.getElementById('cuenta-receptor');
        const saldoDisponibleEl = document.getElementById('emisor-saldo-disponible');
        const alertaSaldoEl = document.getElementById('saldo-insuficiente-alerta');
        const deliveryToggle = document.getElementById('incluye-delivery');
        
        const deliveryModal = document.getElementById('modal-confirmacion-delivery');
        const confirmDeliveryBtn = document.getElementById('confirm-delivery-btn');
        const cancelDeliveryBtn = document.getElementById('cancel-delivery-btn');
        
        const alertaDeudaEl = document.getElementById('alerta-deuda-pendiente');
        const modalPago = document.getElementById('modal-pago-deuda');
        const closeModalBtn = modalPago ? modalPago.querySelector('.close-button') : null;
        const formPagoDeuda = document.getElementById('form-pago-deuda');
        const modalTitle = document.getElementById('modal-title');
        const deudaActualInfo = document.getElementById('deuda-actual-info');
        const montoPagoInput = document.getElementById('monto-pago');
        const deudaTransaccionIdInput = document.getElementById('deuda-transaccion-id');
        
        let transaccionCache = {};
        let deudasPendientesCache = [];

        function actualizarInfoBox() {
            const fechaHoy = new Date();
            document.getElementById('info-fecha').textContent = fechaHoy.toLocaleDateString('es-VE');
            document.getElementById('info-hora').textContent = fechaHoy.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
            const transacciones = JSON.parse(localStorage.getItem('transacciones')) || [];
            const tasasCompra = transacciones.filter(t => t.tipo === 'Compra' && t.tasa).map(t => parseFloat(t.tasa));
            const tasaPromedioCompra = tasasCompra.length > 0 ? tasasCompra.reduce((sum, tasa) => sum + tasa, 0) / tasasCompra.length : 0;
            const tasasVenta = transacciones.filter(t => t.tipo === 'Venta' && t.tasa).map(t => parseFloat(t.tasa));
            const tasaPromedioVenta = tasasVenta.length > 0 ? tasasVenta.reduce((sum, tasa) => sum + tasa, 0) / tasasVenta.length : 0;
            document.getElementById('tasa-info-compra').textContent = `Bs. ${formatNumber(tasaPromedioCompra)}`;
            document.getElementById('tasa-info-venta').textContent = `Bs. ${formatNumber(tasaPromedioVenta)}`;
        }

        function calcularMontoTotalYValidar() {
            const usdOperar = parseFloat(usdOperarInput.value) || 0;
            const tasaAplicada = parseFloat(tasaClienteInput.value) || 0;
            document.getElementById('monto-ves').value = formatNumber(usdOperar * tasaAplicada);
            validarSaldo();
        }

        function validarSaldo() {
            if (tipoOperacionSelect.value !== 'Compra' || !jornadaAbierta) {
                saldoDisponibleEl.style.display = 'none';
                alertaSaldoEl.style.display = 'none';
                if (jornadaAbierta && (!alertaDeudaEl.style.display || alertaDeudaEl.style.display === 'none')) {
                    submitBtn.disabled = false;
                }
                return;
            }
            const cuentaSeleccionadaId = cuentaEmisorSelect.value;
            if (!cuentaSeleccionadaId || cuentaSeleccionadaId === 'Cliente (Externo)') {
                saldoDisponibleEl.style.display = 'none';
                alertaSaldoEl.style.display = 'none';
                if (jornadaAbierta) submitBtn.disabled = false;
                return;
            }
            
            const cuenta = saldosActuales.find(c => c.id === cuentaSeleccionadaId);
            const saldoDisponible = cuenta ? cuenta.saldo : 0;
            saldoDisponibleEl.textContent = `Saldo Disponible: Bs. ${formatNumber(saldoDisponible)}`;
            saldoDisponibleEl.style.display = 'block';

            const montoRequerido = parseFormattedNumber(document.getElementById('monto-ves').value);

            if (montoRequerido > 0 && montoRequerido > saldoDisponible) {
                alertaSaldoEl.style.display = 'block';
                submitBtn.disabled = true;
            } else {
                alertaSaldoEl.style.display = 'none';
                if (jornadaAbierta && (!alertaDeudaEl.style.display || alertaDeudaEl.style.display === 'none')) {
                    submitBtn.disabled = false;
                }
            }
        }
        
        function verificarDeudaCliente() {
            const nombre = clienteInput.value.trim().toLowerCase();
            const telefono = telefonoInput.value.trim();

            if (!nombre || !telefono) {
                alertaDeudaEl.style.display = 'none';
                if (jornadaAbierta) {
                    submitBtn.disabled = false;
                    validarSaldo(); 
                }
                return;
            }

            const transacciones = JSON.parse(localStorage.getItem('transacciones')) || [];
            deudasPendientesCache = transacciones.filter(t => {
                const clienteMatch = t.cliente && t.cliente.trim().toLowerCase() === nombre;
                const telefonoMatch = t.telefono && t.telefono.trim() === telefono;
                return clienteMatch && telefonoMatch && t.saldo_pendiente_usd > 0;
            });

            if (deudasPendientesCache.length > 0) {
                const deudaTotal = deudasPendientesCache.reduce((sum, t) => sum + t.saldo_pendiente_usd, 0);
                alertaDeudaEl.innerHTML = `
                    <span>⚠️ <strong>Atención:</strong> Este cliente tiene una deuda pendiente de <strong>$${formatNumber(deudaTotal)}</strong>.</span>
                    <button id="pagar-deuda-pendiente-btn" class="button button-primary" style="margin-left: 15px; padding: 5px 10px;">Pagar Deuda</button>
                `;
                alertaDeudaEl.style.display = 'block';
                submitBtn.disabled = true;
            } else {
                alertaDeudaEl.style.display = 'none';
                if (jornadaAbierta) {
                    submitBtn.disabled = false;
                    validarSaldo();
                }
            }
        }

        function procederConRegistro() {
            let transacciones = JSON.parse(localStorage.getItem('transacciones')) || [];
            transacciones.push(transaccionCache);
            localStorage.setItem('transacciones', JSON.stringify(transacciones));
            
            showToast('Transacción registrada exitosamente!', 'success');
            setTimeout(() => {
                if (usuarioLogeado.rol === 'administrador' || usuarioLogeado.rol === 'supervisor') {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.reload();
                }
            }, 1000);
        }

        transaccionForm.addEventListener('submit', (event) => {
            event.preventDefault();
            
            const cliente = document.getElementById('cliente').value;
            const telefono = document.getElementById('telefono').value;
            const usdOperar = parseFloat(usdOperarInput.value);
            const usdEntregados = parseFloat(usdEntregadosInput.value);
            const tasaCliente = parseFloat(tasaClienteInput.value);
            const montoVes = parseFormattedNumber(document.getElementById('monto-ves').value);
            const cuentaEmisor = cuentaEmisorSelect.value;
            const cuentaReceptor = cuentaReceptorSelect.value;
            const incluyeDelivery = deliveryToggle.checked;

            if (!cliente || !telefono || isNaN(usdOperar) || isNaN(usdEntregados) || isNaN(tasaCliente) || !cuentaEmisor || !cuentaReceptor) {
                showToast('Todos los campos son obligatorios.', 'error');
                return;
            }

            const saldoPendiente = usdOperar - usdEntregados;
            const estatus = saldoPendiente > 0.009 ? 'Pendiente' : 'Entregado';

            transaccionCache = {
                id: Date.now(),
                tipo: tipoOperacionSelect.value,
                cliente,
                telefono,
                monto_total_usd: usdOperar,
                monto_entregado_usd: usdEntregados,
                saldo_pendiente_usd: saldoPendiente,
                tasa: tasaCliente,
                monto_ves: montoVes,
                banco_cliente: cuentaReceptor,
                cuenta_propia_id: cuentaEmisor,
                estatus,
                delivery: incluyeDelivery,
                fechaHora: new Date().toISOString()
            };

            if (incluyeDelivery) {
                deliveryModal.classList.add('active');
            } else {
                procederConRegistro();
            }
        });
        
        if(confirmDeliveryBtn) {
            confirmDeliveryBtn.addEventListener('click', () => {
                deliveryModal.classList.remove('active');
                procederConRegistro();
            });
        }

        if(cancelDeliveryBtn) {
            cancelDeliveryBtn.addEventListener('click', () => {
                deliveryModal.classList.remove('active');
            });
        }
        
        if(deliveryModal) {
            deliveryModal.addEventListener('click', (e) => {
                if (e.target === deliveryModal) {
                    deliveryModal.classList.remove('active');
                }
            });
        }

        clienteInput.addEventListener('blur', verificarDeudaCliente);
        telefonoInput.addEventListener('blur', verificarDeudaCliente);
        
        usdOperarInput.addEventListener('input', calcularMontoTotalYValidar);
        tasaClienteInput.addEventListener('input', calcularMontoTotalYValidar);
        cuentaEmisorSelect.addEventListener('change', validarSaldo);
        tipoOperacionSelect.addEventListener('change', validarSaldo);
        
        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('usuario-autenticado');
            window.location.href = 'index.html';
        });

        alertaDeudaEl.addEventListener('click', (e) => {
            if (e.target.id === 'pagar-deuda-pendiente-btn') {
                if (deudasPendientesCache.length > 0) {
                    const deudaAPagar = deudasPendientesCache[0];
                    const deudaTotal = deudasPendientesCache.reduce((sum, t) => sum + t.saldo_pendiente_usd, 0);

                    modalTitle.textContent = `Registrar Abono de ${deudaAPagar.cliente}`;
                    deudaActualInfo.textContent = `$${formatNumber(deudaTotal)}`;
                    montoPagoInput.value = deudaTotal.toFixed(2);
                    deudaTransaccionIdInput.value = JSON.stringify(deudasPendientesCache.map(d => d.id));
                    modalPago.classList.add('active');
                }
            }
        });
        
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => modalPago.classList.remove('active'));

        if (formPagoDeuda) {
            formPagoDeuda.addEventListener('submit', (e) => {
                e.preventDefault();
                const idsDeudasJson = deudaTransaccionIdInput.value;
                const idsDeudas = JSON.parse(idsDeudasJson);
                let montoPagadoTotal = parseFloat(montoPagoInput.value);

                if (!idsDeudas || idsDeudas.length === 0 || isNaN(montoPagadoTotal) || montoPagadoTotal <= 0) {
                    showToast('Monto inválido.', 'error');
                    return;
                }

                let transacciones = JSON.parse(localStorage.getItem('transacciones')) || [];
                let deudaTotal = 0;
                idsDeudas.forEach(id => {
                    const transaccionOriginal = transacciones.find(t => t.id == id);
                    if (transaccionOriginal) {
                        deudaTotal += transaccionOriginal.saldo_pendiente_usd;
                    }
                });

                if (montoPagadoTotal > deudaTotal + 0.001) {
                    showToast('El monto del pago no puede ser mayor que la deuda total.', 'error');
                    return;
                }
                
                let montoRestanteAPagar = montoPagadoTotal;
                idsDeudas.forEach(id => {
                    if (montoRestanteAPagar <= 0) return;
                    
                    const transaccionOriginal = transacciones.find(t => t.id == id);
                    if (transaccionOriginal) {
                        const abono = Math.min(montoRestanteAPagar, transaccionOriginal.saldo_pendiente_usd);
                        transaccionOriginal.saldo_pendiente_usd -= abono;
                        montoRestanteAPagar -= abono;

                        if (transaccionOriginal.saldo_pendiente_usd < 0.01) {
                            transaccionOriginal.saldo_pendiente_usd = 0;
                            transaccionOriginal.estatus = 'Entregado';
                        }
                    }
                });

                transacciones.push({
                    id: Date.now(), tipo: 'Pago Cliente', cliente: clienteInput.value,
                    monto_pago_usd: montoPagadoTotal, fechaHora: new Date().toISOString(), 
                    estatus: 'Pagado' 
                });

                localStorage.setItem('transacciones', JSON.stringify(transacciones));
                showToast('¡Pago registrado exitosamente!', 'success');
                modalPago.classList.remove('active');
                
                verificarDeudaCliente();
            });
        }

        actualizarInfoBox();
        validarSaldo();
        
    } catch (error) {
        console.error("Error al iniciar la página de ventas:", error);
        showToast("Ha ocurrido un error grave en la página de ventas.", 'error');
    }
});