// AHORA ES UN MÓDULO: Se añade "export" a las funciones principales

// Variables globales para las instancias de los gráficos
let salesChart, purchasesChart, expensesChart, deliveryChart, profitChart;

// --- FUNCIÓN PRINCIPAL DE INICIALIZACIÓN ---
export function inicializarGraficos() {
    // --- Opciones comunes para los gráficos (estilo oscuro) ---
    const sharedChartOptions = {
        chart: {
            type: 'radialBar',
            offsetY: -20,
            sparkline: {
                enabled: true
            }
        },
        plotOptions: {
            radialBar: {
                startAngle: -90,
                endAngle: 90,
                hollow: {
                    margin: 15,
                    size: '65%',
                    background: '#1C1E21',
                    image: undefined,
                },
                track: {
                    background: '#333333',
                    strokeWidth: '97%',
                    margin: 5,
                },
                dataLabels: {
                    show: true,
                    name: {
                        show: true,
                        offsetY: -15,
                        fontSize: '22px',
                        fontWeight: 'bold',
                        color: '#FFFFFF'
                    },
                    value: {
                        show: true,
                        offsetY: 10,
                        fontSize: '16px',
                        color: '#B0B3B8',
                        formatter: function (val) {
                            return val.toFixed(0) + '% de la meta';
                        }
                    }
                }
            }
        },
        grid: {
            padding: {
                top: -10
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'dark',
                type: 'horizontal',
                shadeIntensity: 0.5,
                inverseColors: true,
                opacityFrom: 1,
                opacityTo: 1,
                stops: [0, 100]
            }
        },
        stroke: {
            lineCap: 'round'
        }
    };

    // --- Gráfico 1: Medidor de Ventas ---
    salesChart = new ApexCharts(document.querySelector("#sales-gauge"), {
        ...sharedChartOptions,
        series: [0],
        colors: ['#00A0A0'],
        plotOptions: { ...sharedChartOptions.plotOptions }
    });
    salesChart.render();

    // --- Gráfico 2: Medidor de Compras ---
    purchasesChart = new ApexCharts(document.querySelector("#purchases-gauge"), {
        ...sharedChartOptions,
        series: [0],
        colors: ['#20B2AA'],
        plotOptions: { ...sharedChartOptions.plotOptions }
    });
    purchasesChart.render();

    // --- Gráfico 3: Medidor de Gastos ---
    expensesChart = new ApexCharts(document.querySelector("#expenses-gauge"), {
        ...sharedChartOptions,
        series: [0],
        colors: ['#dc3545'],
        fill: { ...sharedChartOptions.fill, gradient: { ...sharedChartOptions.fill.gradient, gradientToColors: ['#E3272F'] } },
        plotOptions: { ...sharedChartOptions.plotOptions }
    });
    expensesChart.render();

    // --- Gráfico 4: Medidor de Deliverys ---
    deliveryChart = new ApexCharts(document.querySelector("#delivery-gauge"), {
        ...sharedChartOptions,
        series: [0],
        colors: ['#ffc107'],
        fill: { ...sharedChartOptions.fill, gradient: { ...sharedChartOptions.fill.gradient, gradientToColors: ['#FFD700'] } },
        plotOptions: { ...sharedChartOptions.plotOptions }
    });
    deliveryChart.render();

    // --- Gráfico 5: Medidor de Utilidad ---
    profitChart = new ApexCharts(document.querySelector("#profit-gauge"), {
        ...sharedChartOptions,
        series: [0],
        colors: ['#28a745'],
        fill: { ...sharedChartOptions.fill, gradient: { ...sharedChartOptions.fill.gradient, gradientToColors: ['#30C050'] } },
        plotOptions: { ...sharedChartOptions.plotOptions }
    });
    profitChart.render();
}

// --- FUNCIÓN GLOBAL DE ACTUALIZACIÓN ---
export function actualizarTodosLosGraficos(datos) {
    if (!datos || !salesChart) return; // Verificación de seguridad

    const { ventas, compras, gastos, deliveries, utilidad, metas } = datos;

    const formatNumberForChart = (num, prefix = '', isBs = false) => {
        const number = parseFloat(num);
        if (isNaN(number)) return `${prefix}0`;
        if (isBs) {
            if (number >= 1000000) return `${prefix}${ (number / 1000000).toFixed(1) } M`;
            if (number >= 1000) return `${prefix}${ (number / 1000).toFixed(1) } K`;
        }
        return `${prefix}${number.toLocaleString('es-VE', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    };

    // Actualizar Gráfico de Ventas
    const porcentajeVentas = metas.ventas > 0 ? (ventas / metas.ventas) * 100 : 0;
    salesChart.updateOptions({
        series: [porcentajeVentas],
        plotOptions: { radialBar: { dataLabels: { name: { formatter: () => formatNumberForChart(ventas, '$') } } } }
    });
    document.getElementById('sales-goal').innerText = `Meta: ${formatNumberForChart(metas.ventas, '$')}`;

    // Actualizar Gráfico de Compras
    const porcentajeCompras = metas.compras > 0 ? (compras / metas.compras) * 100 : 0;
    purchasesChart.updateOptions({
        series: [porcentajeCompras],
        plotOptions: { radialBar: { dataLabels: { name: { formatter: () => formatNumberForChart(compras, '$') } } } }
    });
    document.getElementById('purchases-goal').innerText = `Meta: ${formatNumberForChart(metas.compras, '$')}`;
    
    // Actualizar Gráfico de Gastos
    const porcentajeGastos = metas.gastos > 0 ? (gastos / metas.gastos) * 100 : 0;
    expensesChart.updateOptions({
        series: [porcentajeGastos],
        plotOptions: { radialBar: { dataLabels: { name: { formatter: () => formatNumberForChart(gastos, 'Bs. ', true) } } } }
    });
     document.getElementById('expenses-goal').innerText = `Presupuesto: ${formatNumberForChart(metas.gastos, 'Bs. ', true)}`;

    // Actualizar Gráfico de Deliveries
    const porcentajeDeliveries = metas.deliveries > 0 ? (deliveries / metas.deliveries) * 100 : 0;
    deliveryChart.updateOptions({
        series: [porcentajeDeliveries],
        plotOptions: { radialBar: { dataLabels: { name: { formatter: () => formatNumberForChart(deliveries, '') } } } }
    });
     document.getElementById('delivery-goal').innerText = `Meta: ${formatNumberForChart(metas.deliveries, '')}`;

    // Actualizar Gráfico de Utilidad
    const porcentajeUtilidad = metas.utilidad > 0 ? (utilidad / metas.utilidad) * 100 : 0;
    profitChart.updateOptions({
        series: [porcentajeUtilidad],
        plotOptions: { radialBar: { dataLabels: { name: { formatter: () => formatNumberForChart(utilidad, 'Bs. ', true) } } } }
    });
    document.getElementById('profit-goal').innerText = `Meta: ${formatNumberForChart(metas.utilidad, 'Bs. ', true)}`;
}