# Pruebas automáticas — portal de propietarios

Verifican los cálculos del portal (total a cobrar con su desglose, estado de cada mes, abonos).
Extraen las funciones de `index.html` por nombre y las ejecutan aisladas (ver `helpers.mjs`).

```
node --test
```
Corren solas en GitHub en cada subida (`.github/workflows/pruebas.yml`); si fallan, aparece una ✗ junto al commit.
La fecha de las pruebas es fija (15/10/2026), así que los resultados no dependen del día en que se corran.
