// Pruebas automáticas de los cálculos del portal de propietarios.
// Correr:  node --test        (desde propietarios-repo)
// Fecha fija de las pruebas: 15/10/2026.

import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, c2 } from './helpers.mjs';

const ARCHIVO = 'index.html';
const entorno = { TODAY: '2026-10-15', HOY_MES: '2026-10' };
const F = cargar(ARCHIVO, ['rendidoMonto', 'netoRendido', 'brutoDirecto', 'fechaVencimiento', 'detalleNeto', 'evaluarPago'], entorno,
  ['r2', 'ABONOS_DESDE', 'NOMBRES_SERVICIO']);

// ─────────────── Lo que se le rinde al propietario (idéntico criterio que "Ya emitidos") ───────────────
test('netoRendido: alquiler menos comisión', () => {
  assert.equal(F.netoRendido({ alquiler: { monto: 340000 } }, 8, {}), 312800);
});
test('netoRendido: servicios que se rinden suman, a cargo del propietario restan', () => {
  const items = { alquiler: { monto: 340000 }, 'srv-epe-1': { monto: 38000 }, 'srv-prop-agua-2': { monto: 10000 } };
  assert.equal(F.netoRendido(items, 8, {}), 340000 - 27200 + 38000 - 10000);
});
test('netoRendido: extras con su signo (débito resta, crédito suma)', () => {
  const items = { alquiler: { monto: 100000 }, 'extra-6': { monto: 15000 }, 'extra-7': { monto: 4000 } };
  assert.equal(F.netoRendido(items, 0, { 6: 'debito', 7: 'credito' }), 100000 - 15000 + 4000);
});
test('netoRendido: formato viejo (número plano) y objeto {monto} valen igual', () => {
  assert.equal(F.netoRendido({ alquiler: 1000 }, 10, {}), 900);
  assert.equal(F.netoRendido({ alquiler: { monto: 1000 } }, 10, {}), 900);
});
test('brutoDirecto: alquiler + servicios que se rinden; no cuenta extras ni lo que está a cargo del propietario', () => {
  const items = { alquiler: { monto: 340000 }, 'srv-epe-1': { monto: 38000 }, 'srv-prop-agua-2': { monto: 10000 }, 'extra-6': { monto: 15000 } };
  assert.equal(F.brutoDirecto(items), 378000);
});

// ─────────────── Vencimientos ───────────────
test('fechaVencimiento: adelantado vence el día del mes; vencido, el mes siguiente', () => {
  assert.equal(F.fechaVencimiento('2026-10', { dia_vencimiento: 10 }), '2026-10-10');
  assert.equal(F.fechaVencimiento('2026-10', { dia_vencimiento: 20, modalidad_pago: 'VENCIDO' }), '2026-11-20');
  assert.equal(F.fechaVencimiento('2026-12', { dia_vencimiento: 5, modalidad_pago: 'VENCIDO' }), '2027-01-05');
  assert.equal(F.fechaVencimiento('2026-10', {}), '2026-10-10');      // sin día cargado: el 10
});

// ─────────────── Total a cobrar con su desglose ───────────────
test('detalleNeto: sin rendición es un ESTIMADO (alquiler − comisión ± extras, reparto por %)', () => {
  const p = { extras_prop: [{ id: 1, concepto: 'Termotanque', tipo: 'debito', importe: 30000, todos: true }] };
  const c = { comision_porcentaje: 8, mi_porcentaje: 50, cant_propietarios: 2 };
  const d = F.detalleNeto(p, c, 149697.5, true);
  assert.equal(d.estimado, true);
  assert.equal(c2(d.total), 122721.7);       // 149.697,50 − 11.975,80 − (30.000 × 50%)
  assert.deepEqual(d.lineas.map(l => l.label), ['Alquiler (tu 50%)', 'Comisión 8%', 'Termotanque']);
});
test('detalleNeto: con rendición cargada usa exactamente lo rendido (con sus nombres)', () => {
  const p = {
    rendido_items: { alquiler: { monto: 149697.5 }, 'srv-epe-1': { monto: 38000 }, 'extra-6': { monto: 15000 } },
    extras_tipo: { 6: 'debito' }, extras_prop: [{ id: 6, concepto: 'Reparación canilla', tipo: 'debito', importe: 15000, todos: false }]
  };
  const d = F.detalleNeto(p, { comision_porcentaje: 8, mi_porcentaje: 50 }, 149697.5, true);
  assert.equal(d.estimado, false);
  assert.equal(c2(d.total), 160721.7);       // 149.697,50 − 11.975,80 + 38.000 − 15.000
  assert.deepEqual(d.lineas.map(l => l.label), ['Alquiler (tu 50%)', 'Comisión 8%', 'EPE (a rendir)', 'Reparación canilla']);
});
test('detalleNeto: el total del desglose coincide con netoRendido', () => {
  const items = { alquiler: { monto: 340000 }, 'srv-prop-agua-2': { monto: 10000 }, 'extra-6': { monto: 15000 } };
  const p = { rendido_items: items, extras_tipo: { 6: 'debito' }, extras_prop: [] };
  const d = F.detalleNeto(p, { comision_porcentaje: 8 }, 340000, false);
  assert.equal(c2(d.total), F.netoRendido(items, 8, { 6: 'debito' }));
});
test('detalleNeto: un mes sin alquiler ni rendición no muestra total', () => {
  assert.equal(F.detalleNeto({}, { comision_porcentaje: 8 }, 0, false), null);
});

// ─────────────── Estado de cada mes (cobro al inquilino y abono al propietario) ───────────────
{
  const contrato = { dia_vencimiento: 10, modalidad_pago: 'ADELANTADO', cant_propietarios: 1, comision_porcentaje: 8 };
  const mes = (extra = {}, mesKey = '2026-10') => ({ mes: mesKey + '-01', importe_alquiler: 300000, pagado_importe: 0, creditos_inquilino: 0, abonos: [], rendido_items: null, cobro_directo: false, extras_tipo: {}, ...extra });

  test('estado del inquilino: pagó, pagó parcial, vencido, pendiente, futuro y sin alquiler', () => {
    assert.equal(F.evaluarPago(mes({ pagado_importe: 300000 }), contrato).inq, 'pagado');
    assert.equal(F.evaluarPago(mes({ pagado_importe: 100000 }), contrato).inq, 'parcial');
    assert.equal(F.evaluarPago(mes(), contrato).inq, 'vencido');                                        // venció el 10/10
    assert.equal(F.evaluarPago(mes(), { ...contrato, dia_vencimiento: 20 }).inq, 'pendiente');          // vence el 20/10
    assert.equal(F.evaluarPago(mes({}, '2026-11'), contrato).inq, 'futuro');
    assert.equal(F.evaluarPago(mes({ importe_alquiler: 0 }), contrato).inq, 'sinalquiler');
  });
  test('estado del inquilino: los créditos a su favor cuentan como pago', () => {
    assert.equal(F.evaluarPago(mes({ pagado_importe: 290000, creditos_inquilino: 10000 }), contrato).inq, 'pagado');
  });
  test('abono al propietario: pendiente cuando el inquilino pagó y todavía no se abonó', () => {
    assert.equal(F.evaluarPago(mes({ pagado_importe: 300000 }), contrato).abono, 'pendiente');
    assert.equal(F.evaluarPago(mes({ pagado_importe: 100000 }), contrato).abono, 'espera');             // todavía no cobró todo
  });
  test('abono al propietario: abonado, parcial y cobrado directo', () => {
    const rendido = { alquiler: { monto: 340000 } };          // neto = 312.800
    const base = { pagado_importe: 300000, rendido_items: rendido };
    assert.equal(F.evaluarPago(mes({ ...base, abonos: [{ fecha: '2026-10-05', monto: 312800 }] }), contrato).abono, 'abonado');
    assert.equal(F.evaluarPago(mes({ ...base, abonos: [{ fecha: '2026-10-05', monto: 100000 }] }), contrato).abono, 'parcial');
    const directo = F.evaluarPago(mes({ ...base, cobro_directo: true }), contrato);
    assert.equal(directo.abono, 'directo');
    assert.equal(directo.directoBruto, 340000);
  });
  test('abono al propietario: antes de septiembre 2026 no hay registro de abonos', () => {
    assert.equal(F.evaluarPago(mes({ pagado_importe: 300000 }, '2026-08'), contrato).abono, 'sinregistro');
  });
  test('abono al propietario: lo abonado en otra moneda se informa aparte', () => {
    const e = F.evaluarPago(mes({ pagado_importe: 300000, abonos: [{ fecha: '2026-10-05', monto: 500, moneda: 'USD' }] }), contrato);
    assert.deepEqual(e.otrasMonedas, { USD: 500 });
    assert.equal(e.abonadoARS, 0);
  });
  test('parte del propietario cuando hay varios: el porcentaje de cada uno', () => {
    const e = F.evaluarPago(mes(), { ...contrato, cant_propietarios: 2, mi_porcentaje: 50 });
    assert.equal(e.miParte, 150000);
  });
}
