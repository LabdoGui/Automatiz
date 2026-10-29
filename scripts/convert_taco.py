"""Converte a base TACO (SQLite publicada em github.com/raulfdm/taco-api, licença MIT)
para o JSON usado na seed do VIVA (prisma/seed/data/taco.json).

Fonte primária dos dados: Tabela Brasileira de Composição de Alimentos (TACO),
4ª edição revisada e ampliada, NEPA/UNICAMP, 2011. Reprodução permitida com citação.

Uso:
    curl -L -o /tmp/taco/taco.db \
      https://raw.githubusercontent.com/raulfdm/taco-api/main/apps/api/prisma/taco.db
    python3 -I scripts/convert_taco.py /tmp/taco/taco.db prisma/seed/data/taco.json

Nenhum valor é estimado aqui: campos nulos na fonte permanecem nulos.
"""

import json
import sqlite3
import sys

FIELDS = {
    "kcal": "kcal",
    "protein": "proteinG",
    "lipids": "fatG",
    "carbohydrates": "carbsG",
    "dietaryFiber": "fiberG",
    "sodium": "sodiumMg",
    "moisture": "moisturePct",
}


def main(db_path: str, out_path: str) -> None:
    con = sqlite3.connect(db_path)
    rows = con.execute(
        """
        select f.id, trim(f.name), c.name, n.kcal, n.protein, n.lipids,
               n.carbohydrates, n.dietaryFiber, n.sodium, n.moisture
        from foods f
        join categories c on c.id = f.categoryId
        left join nutrients n on n.foodId = f.id
        order by f.id
        """
    ).fetchall()
    foods = []
    for row in rows:
        taco_id, name, category, *values = row
        item = {"tacoId": taco_id, "name": " ".join(name.split()), "category": category}
        for (src, dst), value in zip(FIELDS.items(), values):
            item[dst] = value
        foods.append(item)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "source": {
                    "code": "TACO4",
                    "name": "Tabela Brasileira de Composição de Alimentos (TACO)",
                    "publisher": "NEPA/UNICAMP",
                    "edition": "4ª edição revisada e ampliada",
                    "year": 2011,
                    "url": "https://www.nepa.unicamp.br/taco/",
                    "license": "Reprodução permitida desde que citada a fonte (NEPA/UNICAMP). Extração estruturada: raulfdm/taco-api (MIT).",
                },
                "foods": foods,
            },
            fh,
            ensure_ascii=False,
            indent=1,
        )
    print(f"{len(foods)} alimentos exportados para {out_path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
