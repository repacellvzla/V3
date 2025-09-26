import { formatNumber, formatFechaCorta, formatHora, safeJSONParse } from './utils.js';

export function getRowDataForExport(t) {
    let operacion = t.tipo || 'N/A', cliente = t.cliente || 'N/A', tasa = 'N/A', saldoPendiente = 'N/A', observacion = t.concepto || '';
    let bancoMostrado = t.cuenta_propia_id || 'N/A';
    let montoPrincipal = 'N/A';
    if ((t.tipo === 'Venta' || t.tipo === 'Compra') && t.delivery === true) { operacion += ' (Delivery)'; }
    if (t.tipo === 'Venta' || t.tipo === 'Compra') {
        tasa = t.tasa ? formatNumber(t.tasa) : 'N/A';
        saldoPendiente = (t.saldo_pendiente_usd != null) ? `$${formatNumber(t.saldo_pendiente_usd)}` : 'N/A';
        bancoMostrado = t.banco_cliente || 'N/A';
        montoPrincipal = (t.tipo === 'Venta') ? `Bs. ${formatNumber(t.monto_ves)}` : `$${formatNumber(t.monto_total_usd)}`;
    } else if (t.tipo === 'Transferencia Propia') {
        cliente = "Admin";
        bancoMostrado = `${t.cuenta_propia_id} -> ${t.cuenta_destino_id}`;
        montoPrincipal = `Bs. ${formatNumber(t.monto_transferencia)}`;
    } else if (t.tipo === 'Ingreso Saldo') {
        cliente = 'Admin';
        bancoMostrado = t.cuenta_propia_id;
        montoPrincipal = (t.cuenta_propia_id === 'Custodia $') ? `$${formatNumber(t.monto_ingreso)}` : `Bs. ${formatNumber(t.monto_ingreso)}`;
    } else if (t.tipo === 'Pago Cliente') {
        montoPrincipal = `$${formatNumber(t.monto_pago_usd)}`;
        bancoMostrado = 'Custodia $'; saldoPendiente = '$0,00';
    } else if (t.tipo === 'Gasto') {
        cliente = 'Admin';
        bancoMostrado = t.cuenta_origen_id;
        const simbolo = t.cuenta_origen_id === 'Custodia $' ? '$' : 'Bs.';
        montoPrincipal = `${simbolo} ${formatNumber(t.monto_gasto)}`;
    }
    return [formatFechaCorta(t.fechaHora), formatHora(t.fechaHora), operacion, cliente, tasa, montoPrincipal, bancoMostrado, saldoPendiente, t.estatus || 'N/A', observacion];
}

export function renderizarKPIs(bancos, transacciones, calcularUtilidad) {
    const kpiBancosContainer = document.getElementById('kpi-grid-bancos');
    const kpiTotalesContainer = document.getElementById('kpi-grid-totales');
    if (!kpiBancosContainer || !kpiTotalesContainer) return;

    const getKpiClass = (value) => (value > 0 ? 'positive' : '');
    const getUtilityClass = (value) => (value > 0 ? 'positive' : 'negative');

    const totalUSDOperados = transacciones.filter(t => t.tipo === 'Compra' || t.tipo === 'Venta').reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0);
    const totalBSDisponible = bancos.filter(b => b.id !== "Custodia $").reduce((sum, b) => sum + (parseFloat(b.saldo) || 0), 0);
    const totalCustodiaUSD = bancos.find(b => b.id === "Custodia $")?.saldo || 0;
    const deudaTotalUSD = transacciones.reduce((sum, t) => sum + (parseFloat(t.saldo_pendiente_usd) || 0), 0);
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyTrans = transacciones.filter(t => {
        const fechaT = new Date(t.fechaHora);
        fechaT.setHours(0, 0, 0, 0);
        return fechaT.getTime() === hoy.getTime();
    });

    const todasLasCompras = transacciones.filter(t => t.tipo === 'Compra');
    const config = safeJSONParse('configuracion', {costos_fijos:[]});
    const utilidadDiaria = calcularUtilidad(hoyTrans, todasLasCompras, config.costos_fijos);

    const gastosDeHoy = hoyTrans.filter(t => t.tipo === 'Gasto');
    const gastosHoyBs = gastosDeHoy.filter(g => g.cuenta_origen_id !== 'Custodia $').reduce((sum, g) => sum + parseFloat(g.monto_gasto), 0);
    const gastosHoyUsd = gastosDeHoy.filter(g => g.cuenta_origen_id === 'Custodia $').reduce((sum, g) => sum + parseFloat(g.monto_gasto), 0);

    kpiTotalesContainer.innerHTML = `
        <div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Total USD Operados</h5><p class="${getKpiClass(totalUSDOperados)}">$ ${formatNumber(totalUSDOperados)}</p></div></div>
        <div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Total Bs. Disponible</h5><p class="${getKpiClass(totalBSDisponible)}">Bs. ${formatNumber(totalBSDisponible)}</p></div></div>
        <div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Total en Custodia USD</h5><p class="${getKpiClass(totalCustodiaUSD)}">$ ${formatNumber(totalCustodiaUSD)}</p></div></div>
        <div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Deuda Total (USD)</h5><p class="${deudaTotalUSD > 0 ? 'negative' : ''}">$ ${formatNumber(deudaTotalUSD)}</p></div></div>
        <div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Utilidad del Día (Bs.)</h5><p class="${getUtilityClass(utilidadDiaria)}">Bs. ${formatNumber(utilidadDiaria)}</p></div></div>
        <div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Gastos del Día (Bs.)</h5><p class="negative">Bs. ${formatNumber(gastosHoyBs)}</p></div></div>
        <div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Gastos del Día ($)</h5><p class="negative">$ ${formatNumber(gastosHoyUsd)}</p></div></div>`;

    kpiBancosContainer.innerHTML = '';
    bancos.forEach(banco => {
        const simboloMoneda = (banco.id === "Custodia $") ? "$" : "Bs.";
        kpiBancosContainer.innerHTML += `<div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>${banco.nombre}</h5><p class="${getKpiClass(banco.saldo)}">${simboloMoneda} ${formatNumber(banco.saldo)}</p></div></div>`;
    });
}

export function renderizarDeudas(transacciones) {
    const debtList = document.getElementById('debt-list');
    if (!debtList) return;
    debtList.innerHTML = '';
    const deudas = transacciones.filter(t => t.saldo_pendiente_usd > 0);
    if (deudas.length === 0) { debtList.innerHTML = '<li>No hay deudas pendientes.</li>'; return; }
    deudas.forEach(deuda => {
        const li = document.createElement('li');
        li.className = 'debt-item'; 
        li.innerHTML = `<span class="debt-info">${deuda.cliente} - $${formatNumber(deuda.saldo_pendiente_usd)}</span><div class="debt-actions"><span class="status pendiente">Pendiente</span><button class="button button-primary pagar-deuda-btn" data-id="${deuda.id}">Registrar Pago</button></div>`;
        debtList.appendChild(li);
    });
}

export function renderizarTablaCuentas(bancos) {
    const origenSelect = document.getElementById('cuenta-origen');
    const destinoSelect = document.getElementById('cuenta-destino');
    const gastoOrigenSelect = document.getElementById('gasto-cuenta-origen');
    if (!origenSelect || !destinoSelect || !gastoOrigenSelect) return;
    origenSelect.innerHTML = destinoSelect.innerHTML = gastoOrigenSelect.innerHTML = '<option value="" disabled selected>Seleccione</option>';
    if (Array.isArray(bancos)) {
        bancos.forEach(banco => {
            const optionHTML = `<option value="${banco.id}">${banco.nombre}</option>`;
            origenSelect.innerHTML += optionHTML;
            destinoSelect.innerHTML += optionHTML;
            gastoOrigenSelect.innerHTML += optionHTML;
        });
    }
}

export function renderizarTablaTransacciones(transacciones) {
    const tbody = document.getElementById('tabla-transacciones')?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    transacciones.sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));
    transacciones.forEach(t => {
        let operacion = t.tipo || 'N/A', cliente = t.cliente || 'N/A', tasa = 'N/A', saldoPendiente = 'N/A', observacion = t.concepto || '';
        let bancoMostrado = t.cuenta_propia_id || 'N/A';
        let montoPrincipal = 'N/A';
        if ((t.tipo === 'Venta' || t.tipo === 'Compra') && t.delivery === true) { operacion += ' 🛵'; }
        if (t.tipo === 'Venta' || t.tipo === 'Compra') {
            tasa = t.tasa ? formatNumber(t.tasa) : 'N/A';
            saldoPendiente = (t.saldo_pendiente_usd != null) ? `$${formatNumber(t.saldo_pendiente_usd)}` : 'N/A';
            bancoMostrado = t.banco_cliente || 'N/A';
            montoPrincipal = (t.tipo === 'Venta') ? `Bs. ${formatNumber(t.monto_ves)}` : `$${formatNumber(t.monto_total_usd)}`;
        } else if (t.tipo === 'Transferencia Propia') {
            cliente = "Admin";
            bancoMostrado = `${t.cuenta_propia_id} -> ${t.cuenta_destino_id}`;
            montoPrincipal = `Bs. ${formatNumber(t.monto_transferencia)}`;
        } else if (t.tipo === 'Ingreso Saldo') {
            cliente = 'Admin';
            bancoMostrado = t.cuenta_propia_id;
            montoPrincipal = (t.cuenta_propia_id === 'Custodia $') ? `$${formatNumber(t.monto_ingreso)}` : `Bs. ${formatNumber(t.monto_ingreso)}`;
        } else if (t.tipo === 'Pago Cliente') {
            montoPrincipal = `$${formatNumber(t.monto_pago_usd)}`;
            bancoMostrado = 'Custodia $'; saldoPendiente = '$0,00';
        } else if (t.tipo === 'Gasto') {
            cliente = 'Admin';
            bancoMostrado = t.cuenta_origen_id;
            const simbolo = t.cuenta_origen_id === 'Custodia $' ? '$' : 'Bs.';
            montoPrincipal = `${simbolo} ${formatNumber(t.monto_gasto)}`;
        }
        tbody.innerHTML += `<tr><td>${formatFechaCorta(t.fechaHora)}</td><td>${formatHora(t.fechaHora)}</td><td>${operacion}</td><td>${cliente}</td><td>${tasa}</td><td>${montoPrincipal}</td><td>${bancoMostrado}</td><td>${saldoPendiente}</td><td><span class="status ${t.estatus ? t.estatus.toLowerCase() : ''}">${t.estatus || 'N/A'}</span></td><td>${observacion}</td></tr>`;
    });
}

export function renderizarFees() {
    const tablaFeesBody = document.getElementById('tabla-fees')?.querySelector('tbody');
    const feeCuentaSelect = document.getElementById('fee-cuenta');
    const config = safeJSONParse('configuracion', { bancos: [], costos_fijos: [], fees: {} });
    if (!tablaFeesBody) return;
    tablaFeesBody.innerHTML = '';
    if (config.fees && Object.keys(config.fees).length > 0) {
        for (const cuentaId in config.fees) {
            const nombreCuenta = cuentaId;
            const fee = config.fees[cuentaId];
            const feeComentario = typeof fee === 'object' ? fee.comentario : '';
            const feeValor = typeof fee === 'object' ? fee.valor : fee;
            tablaFeesBody.innerHTML += `<tr><td>${nombreCuenta}</td><td>${feeValor} %</td><td>${feeComentario}</td><td><button class="button button-danger remove-fee" data-cuenta="${cuentaId}">Eliminar</button></td></tr>`;
        }
    } else {
        tablaFeesBody.innerHTML = '<tr><td colspan="4">No hay fees registrados.</td></tr>';
    }
    if (feeCuentaSelect) {
        const bancos = safeJSONParse('configuracion', { bancos: [] }).bancos || [];
        feeCuentaSelect.innerHTML = `<option value="" disabled selected>Seleccione una cuenta</option>`;
        bancos.forEach(banco => {
            if (!config.fees || !config.fees[banco.id]) {
                feeCuentaSelect.innerHTML += `<option value="${banco.id}">${banco.nombre}</option>`;
            }
        });
    }
}

export function renderizarCostosFijos() {
    const tablaCostosFijosBody = document.getElementById('tabla-costos-fijos')?.querySelector('tbody');
    if (!tablaCostosFijosBody) return;
    const config = safeJSONParse('configuracion', { costos_fijos: [] });
    tablaCostosFijosBody.innerHTML = '';
    if (config.costos_fijos && config.costos_fijos.length > 0) {
        config.costos_fijos.forEach(costo => {
            tablaCostosFijosBody.innerHTML += `<tr><td>${costo.nombre}</td><td>${formatNumber(costo.monto)}</td><td>${costo.moneda}</td><td><button class="button button-danger remove-costo-fijo" data-id="${costo.id}">Eliminar</button></td></tr>`;
        });
    } else {
        tablaCostosFijosBody.innerHTML = '<tr><td colspan="4">No hay costos fijos registrados.</td></tr>';
    }
}

export function renderizarHistorialCierres() {
    const container = document.getElementById('historial-cierres-container');
    if (!container) return;
    const historial = safeJSONParse('historial_cierres', []).sort((a,b) => new Date(b.inicioTimestamp) - new Date(a.inicioTimestamp));
    if (historial.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px 0;">No hay cierres de jornada registrados.</p>';
        return;
    }
    container.innerHTML = '';
    historial.forEach(cierre => {
        const el = document.createElement('div');
        el.className = 'cierre-item';
        el.innerHTML = `<div class="cierre-header" data-timestamp="${cierre.inicioTimestamp}"><h6>Jornada del ${formatFechaCorta(cierre.inicioTimestamp)}</h6><div class="cierre-header-actions"><button class="button button-secondary ver-detalles-cierre-btn">Ver Detalles</button><button class="button button-primary descargar-cierre-btn">Descargar PDF</button></div></div><div class="cierre-details"></div>`;
        container.appendChild(el);
    });
}

export function renderizarMetas() {
    const config = safeJSONParse('configuracion', { metas: {} });
    const DEFAULT_METAS = { ventas: 5000, compras: 7000, gastos: 1000000, deliveries: 10, utilidad: 2000000 };
    const metas = config.metas && Object.keys(config.metas).length ? config.metas : DEFAULT_METAS;
    document.getElementById('meta-ventas').value = formatNumber(metas.ventas);
    document.getElementById('meta-compras').value = formatNumber(metas.compras);
    document.getElementById('meta-gastos').value = formatNumber(metas.gastos);
    document.getElementById('meta-utilidad').value = formatNumber(metas.utilidad);
    document.getElementById('meta-deliveries').value = metas.deliveries;
}