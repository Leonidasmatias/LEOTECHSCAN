# Sentinel Core / Sentinel Intelligence Graph

Camada central de conhecimento do LeoTechScan.

O SIG usa SQLite auxiliar para materializar uma amostra configuravel de nos e relacoes, sem substituir a base `sites` e sem migrar para banco externo.

## Build

`POST /api/sentinel-core/build`

Payload:

```json
{ "limit": 1000, "reset": true }
```

## Modelo

Nos: SITE, MUNICIPALITY, STATE, OPERATOR, TECHNOLOGY, PROJECT, COORDINATE, TRUST_SCORE, SATELLITE_VALIDATION e outros tipos reservados.

Relacoes: LOCATED_IN, BELONGS_TO_OPERATOR, HAS_TECHNOLOGY, HAS_PROJECT, HAS_COORDINATE, HAS_TRUST_SCORE, HAS_SATELLITE_EVIDENCE e demais tipos reservados.

## Limitacao

Esta sprint implementa a fundacao sample/incremental. O build completo dos 299k sites deve ser feito em lotes em sprint futura.
