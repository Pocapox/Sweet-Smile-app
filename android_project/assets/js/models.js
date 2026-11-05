// js/models.js - Initial domain models and seed data for Sweet Smile Pastry

export const INITIAL_PRODUCTS = [
  {
    id: "p1",
    name: "Pastel Red Velvet (8 porc.)",
    category: "pasteles",
    price: 28.00,
    cost: 11.80,
    stock: 4,
    unit: "unidad",
    description: "Bizcocho aterciopelado con crema suave de queso mascarpone y migas rubí.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAEjgP9WLGhKmmRngYIvpMy5bizc9gvxS7KvmL8ZSYsRyFgm1Wb--rtADIk1OAqLC5weD7EMfY0jpdq-yi4fn2vHxTl_en-_GA-s67Pmn-xiaYdHK61dPk8ubiOmydhDL4aqHLOziZqjInpsY8xQsKlvRuC0mi9Aj30W_M6ErqflejfA26jxBQao_NqIPO7JRvIqq-ZoI3fdM15aalvDb9n6ObkQy_iJYLsA9_cQQ",
    barcode: "750100123456",
    recipeId: "rec-redvelvet"
  },
  {
    id: "p2",
    name: "Cupcake de Vainilla & Cereza",
    category: "cupcakes",
    price: 3.50,
    cost: 1.20,
    stock: 18,
    unit: "porción",
    description: "Bizcocho de vainilla bourbon con buttercream artesanal y cereza confitada.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAuYmob8U8YDFdUIx43cCnc76Fzoi4rOPEXrj_ChPPuLnyYnhQMzc8bEtOs71D-wfq56__PYppUUO573t6oJhWmqMqHO-xv5jSi94MKpqK1UDVZLBErkxWsZLl4JdChxUP9HiCRFAxYnSxryy_WbBNq9oMiLHX28vnTxehDgWVJcd6osJHtJ-phsanzMJUfW9vtnMSnBHO0ZWUbl5F4sK1FW8QC7PkVQpsaQVM-gg",
    barcode: "750100123457",
    recipeId: "rec-cupcake"
  },
  {
    id: "p3",
    name: "Tarta de Frutos Rojos",
    category: "pasteles",
    price: 22.00,
    cost: 9.40,
    stock: 2,
    unit: "tarta",
    description: "Masa quebrada crujiente con crema pastelera aromatizada y berries frescos.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAvMsaSMjsEZYoudiNOhu_EynX1VrcZTs9eJDp_rC7TRo06-qRTVRPJTnk_qO5ztliYhsF2q2hZqnQbODnWlYKoPcjtmpfF3cXuFwfdJNjQHyt4b4ThMlE4dEW7UVNx3xl4e8oo-c59sBEEEM1tYXzMvklsiDmvQn0YPkKHLllG-n5r08-rljpGmihKcMAvwBVYCp0CDnXw4iFjS_K5veB4U7kNgEa2IB2AUSg6Lw",
    barcode: "750100123458",
    recipeId: "rec-tartaroja"
  },
  {
    id: "p4",
    name: "Galletas Chispas Chocolate (x6)",
    category: "galletas",
    price: 7.50,
    cost: 2.80,
    stock: 12,
    unit: "pack",
    description: "Galletas doradas con trozos de chocolate amargo 70% y escamas de sal marina.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuA-Bm9JE4H2d7Zg7Jo2NEvgdgvYF4w7tQDrqetgBQGYVUzgE-zGTwn64DN1xML145Rua9DedI7_NPhhcJffYK8UPlIHto8Oij9KN7X7wSRktl05USNe6XdEUMfmvFqZQ4xWix9wtB1I4MG28NLTKUnWi1kAzhDrw_j3x0w2Ku1bHP_Up72w9l2Ue-N4P4H1jvpGp-Mgs_ep4t4J8N97V39DfzavGYCmICpbnXnfuQ",
    barcode: "750100123459",
    recipeId: "rec-cookies"
  },
  {
    id: "p5",
    name: "Macarons Surtidos (Caja 6)",
    category: "postres",
    price: 14.00,
    cost: 4.90,
    stock: 8,
    unit: "caja",
    description: "Delicados macarons franceses de pistacho, frambuesa, caramelo y mora.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuB_cf7qba0DpuPFI8sz1E5KkBjDO6XP4iUdF55DrTjYXLmuY6Pcrfr16qj65RXTxLU68JVDZUT2mn-WmrbNHvgYGvzpbistKb31MSP_F93uaW56Pf9ogYeN0xrZseuEalhWnok667RXMx0MiTtaPEQzBnbVg-VTS2ZJJzf9JTYlJuYa90IE9SSNdzpI4vDzXmY60zpDwkiznEapb0uyFe4F0SXnVQMUCxqCyni63w",
    barcode: "750100123460",
    recipeId: "rec-macarons"
  },
  {
    id: "p6",
    name: "Pastel Selva Negra Especial 20cm",
    category: "pasteles",
    price: 34.75,
    cost: 13.90,
    stock: 5,
    unit: "unidad",
    description: "Bizcochuelo de chocolate amargo embebido en licor de cerezas con virutas.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCUGUg7P1C8LywkVtJqLkY4D53zo4tyqUmnYtj_JEKHBXSQekjkhTphOh6O5krRL-kggUEmVtQpV5VAcJo-uhyGaHVaSkGFQmO88hOeySu-Lh67MNxdFHCT75hrbeY62OdASz7Ur-oMQGjNBfLa_BdtDuLJX48i78-dVjXW6Ou3GZ538o51lALo-LkBQ3e_oHxldp3tfiQgF8qu4XHz9NXMmvxLHqgoZcwI36eenA",
    barcode: "750100123461",
    recipeId: "rec-042"
  },
  {
    id: "p7",
    name: "Cheesecake Vasco de Fresa",
    category: "pasteles",
    price: 28.00,
    cost: 11.20,
    stock: 6,
    unit: "unidad",
    description: "Cheesecake tostado estilo Donostia con coulis de fresas silvestres.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBg9SAdmLp8guizBKJd4Zwlr24RKxGScAotsml_LSxSZBobd6Nn90gIiHkMUj0AmiXkjqhxk5cPB5fV5BtDjLnXCLRceh0lO5JPqvxd5s86YV2263l5z7Ni_uXOxLgT7yPXakp-G4Yx1IcQH8JLuGP69Y_Oa-wvEtHMtItmgcBYAhBUq3WBQ5c0PJfud9AWVdz-JY-4c3mfHyRIEX8PsId95EUA8IVraZQ5HG6Gfg",
    barcode: "750100123462",
    recipeId: "rec-cheesecake"
  },
  {
    id: "p8",
    name: "Croissant Francés de Mantequilla",
    category: "postres",
    price: 3.80,
    cost: 1.45,
    stock: 15,
    unit: "porción",
    description: "Croissant hojaldrado con 100% mantequilla europea de 82% materia grasa.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC5SaRNBTOP1mUc2qrzbxq670soQBiefsSyD-hsk34UiMk_o9gm0yu64W2BXRPc7W6WVq5eSE9QcsuSZF7Wbh4V04Q63ZXtvPXVI5unVMw2-r4T1ZpsPwUL0btcC_DuJBdoyHV31YJ0Ut-j_CQO7yl3lNPiHci9_c-TDKX6SEtotyL633bQ6-XxYmlixxg0irbegGW5C-TZn5PHU3gafOMrgneEhO5d0fLFTdzNGw",
    barcode: "750100123463",
    recipeId: "rec-croissant"
  },
  {
    id: "p9",
    name: "Pavlova de Frutos Rojos",
    category: "postres",
    price: 4.50,
    cost: 1.15,
    stock: 8,
    unit: "porción",
    description: "Nido crujiente de merengue francés con chantilly de vainilla y arándanos.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBNE-784HDJXB4kNP35FAQXvEwhuHkObvuW2SgU9tFfVE257l77KBRGI9Gg2zH1aeQzh3KINefMhOB5qhWFPMDT5btArKRjdgNVjjenJjJm_dn2COcCYGFjHYivh90FQEosh3nftZGQld4Edw0ydn6KOSanlyPNnxWeBL3Tq2DtufodUOpMW8aEsXsFpY57BsJREZA8K-h3dTlEbGiku3qIiO6JjcZ4_H5Gkb0qLg",
    barcode: "750100123464",
    recipeId: "rec-pavlova"
  },
  {
    id: "p10",
    name: "Café Latte Especial de la Casa",
    category: "bebidas",
    price: 3.50,
    cost: 0.85,
    stock: 40,
    unit: "taza",
    description: "Espresso doble con leche texturizada de origen y toque de vainilla.",
    image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=400&q=80",
    barcode: "750100123465",
    recipeId: null
  }
];

export const INITIAL_INVENTORY = [
  {
    id: "inv-1",
    name: "Mantequilla Repostera 82% MG",
    category: "Lácteos",
    stock: 2.5,
    unit: "kg",
    minStock: 8.0,
    costPerUnit: 10.00,
    supplier: "Lácteos Andinos S.A.",
    expDate: "2026-11-09",
    status: "critical",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDSn7RfYAiVYIHdo7Z6YPh_WG9-TKa9hgOlyhCPjpYeTgfJVtEK7XOwNKa5KpWjzSapSXtR4WFTjwfbeQj5R_-POMRt3_WKOQwZzorEvHYTLRUoUr4LAX1QkkLeaFMOkJB3s8TgBsZQdmnK1O5wG4y3UNUyWcO9BF5Q0Eam5iFqlTKQeQHB0U9HNlEViQt479Gvj1wIjwKZIU9yq25GmYW3syeMNnQY3Bp_568nyg"
  },
  {
    id: "inv-2",
    name: "Harina de Trigo Pastelera",
    category: "Harinas & Azúcares",
    stock: 45.0,
    unit: "kg",
    minStock: 20.0,
    costPerUnit: 2.00,
    supplier: "Molinos del Molino",
    expDate: "2027-02-15",
    status: "optimal",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwgvet1uQjb_YFU5rs2H7EGFNW2utNoHxUiMJx-sA19lpVZRtV7ex4PoJshnm4UU7M3ZfOm0v1vyPOpOs_p5vd05T1TPm_dHm24IjnRlFOp-Mby2jjfKUEGH4P7bncO53CsQauop5IeuAgP5fZQ_cTa2di2wts4Kd_KZryKOTPNmnboDp500wW46xmA3zX9e4Tdhqwa9RN6UndR5IRDqh-J4oA4xbP2KvoRRtMiA"
  },
  {
    id: "inv-3",
    name: "Cerezas en Almíbar Sweet",
    category: "Frutas & Rellenos",
    stock: 6.0,
    unit: "frascos",
    minStock: 4.0,
    costPerUnit: 4.50,
    supplier: "Conservas Gourmet",
    expDate: "2027-04-10",
    status: "optimal",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC4IokPmMSVObLb55kccybtexvCeFrTY11pUknMAPqOkp70xsykNn-WzJdSsc6gYWDv7cdg_bPhfj1xebmz9xZjp-4fZGcTfh8wixk5eN7PFYO4kylEdZ2M6TFRM-pEGUU5jNcfKE49zrwK0OKIcaf0MVNpwTRE18-ZERqTn1LSvJm24Oiexd2EjOJZQw88rczzHP1gVdjqLR8HH8xRKEp9U0ciOijdJODOhVE6FA"
  },
  {
    id: "inv-4",
    name: "Cajas Tarta 22cm c/ Ventana",
    category: "Packaging",
    stock: 15.0,
    unit: "unid",
    minStock: 30.0,
    costPerUnit: 1.10,
    supplier: "Empaques Dulces",
    expDate: "2028-01-01",
    status: "critical",
    image: null
  },
  {
    id: "inv-5",
    name: "Fresas Frescas de Huerto",
    category: "Frutas & Rellenos",
    stock: 4.2,
    unit: "kg",
    minStock: 6.0,
    costPerUnit: 5.20,
    supplier: "Huerta San Pedro",
    expDate: "2026-11-06",
    status: "warning",
    image: null
  },
  {
    id: "inv-6",
    name: "Huevos Frescos de Granja",
    category: "Lácteos",
    stock: 120.0,
    unit: "unid",
    minStock: 50.0,
    costPerUnit: 0.25,
    supplier: "Avícola Central",
    expDate: "2026-11-20",
    status: "optimal",
    image: null
  },
  {
    id: "inv-7",
    name: "Chocolate Amargo 70% Cacao",
    category: "Harinas & Azúcares",
    stock: 8.5,
    unit: "kg",
    minStock: 4.0,
    costPerUnit: 16.00,
    supplier: "Cacao del Rey",
    expDate: "2027-08-30",
    status: "optimal",
    image: null
  },
  {
    id: "inv-8",
    name: "Azúcar Glas Refinada",
    category: "Harinas & Azúcares",
    stock: 22.0,
    unit: "kg",
    minStock: 10.0,
    costPerUnit: 1.80,
    supplier: "Ingenio Dulce",
    expDate: "2027-10-01",
    status: "optimal",
    image: null
  },
  {
    id: "inv-9",
    name: "Queso Crema Tipo Filadelfia",
    category: "Lácteos",
    stock: 5.0,
    unit: "kg",
    minStock: 6.0,
    costPerUnit: 8.50,
    supplier: "Lácteos Andinos S.A.",
    expDate: "2026-11-18",
    status: "warning",
    image: null
  },
  {
    id: "inv-10",
    name: "Empaque & Cinta Sweet Smile",
    category: "Packaging",
    stock: 60.0,
    unit: "kit",
    minStock: 25.0,
    costPerUnit: 1.10,
    supplier: "Empaques Dulces",
    expDate: "2028-12-31",
    status: "optimal",
    image: null
  }
];

export const INITIAL_RECIPES = [
  {
    id: "rec-042",
    code: "#042",
    name: "Pastel Selva Negra Especial 20cm",
    category: "Tortas",
    bestseller: true,
    portions: 10,
    prepTime: "2h 30m",
    difficulty: "Media",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCUGUg7P1C8LywkVtJqLkY4D53zo4tyqUmnYtj_JEKHBXSQekjkhTphOh6O5krRL-kggUEmVtQpV5VAcJo-uhyGaHVaSkGFQmO88hOeySu-Lh67MNxdFHCT75hrbeY62OdASz7Ur-oMQGjNBfLa_BdtDuLJX48i78-dVjXW6Ou3GZ538o51lALo-LkBQ3e_oHxldp3tfiQgF8qu4XHz9NXMmvxLHqgoZcwI36eenA",
    ingredients: [
      { id: "i1", name: "Harina de Trigo Especial", quantity: 0.40, unit: "kg", unitCost: 2.00, totalCost: 0.80 },
      { id: "i2", name: "Mantequilla sin sal 82%", quantity: 0.25, unit: "kg", unitCost: 10.00, totalCost: 2.50 },
      { id: "i3", name: "Cerezas al marrasquino", quantity: 0.15, unit: "kg", unitCost: 12.67, totalCost: 1.90 },
      { id: "i4", name: "Chocolate amargo 70%", quantity: 0.20, unit: "kg", unitCost: 16.00, totalCost: 3.20 },
      { id: "i5", name: "Huevos frescos", quantity: 4, unit: "unid", unitCost: 0.225, totalCost: 0.90 },
      { id: "i6", name: "Empaque & Cinta Sweet Smile", quantity: 1, unit: "kit", unitCost: 1.10, totalCost: 1.10 }
    ],
    indirectCost: 3.50, // Gas, electricidad, mano de obra
    targetMargin: 60, // 60%
    suggestedPrice: 34.75,
    actualPrice: 34.75,
    instructions: [
      "Batir los huevos con el azúcar a punto letra hasta triplicar su volumen.",
      "Fundir el chocolate amargo al baño María e integrar con la mantequilla pomada.",
      "Incorporar la harina tamizada con movimientos envolventes para no perder aire.",
      "Hornear en molde de 20cm a 175°C por 35 minutos.",
      "Desmoldar, enfriar, cortar en 3 discos y humedecer con licor de cerezas.",
      "Rellenar con crema chantilly y cerezas picadas, cubrir con virutas de chocolate."
    ]
  },
  {
    id: "rec-cheesecake",
    code: "#039",
    name: "Cheesecake Vasco de Fresa",
    category: "Tortas",
    bestseller: true,
    portions: 8,
    prepTime: "1h 45m",
    difficulty: "Fácil",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBg9SAdmLp8guizBKJd4Zwlr24RKxGScAotsml_LSxSZBobd6Nn90gIiHkMUj0AmiXkjqhxk5cPB5fV5BtDjLnXCLRceh0lO5JPqvxd5s86YV2263l5z7Ni_uXOxLgT7yPXakp-G4Yx1IcQH8JLuGP69Y_Oa-wvEtHMtItmgcBYAhBUq3WBQ5c0PJfud9AWVdz-JY-4c3mfHyRIEX8PsId95EUA8IVraZQ5HG6Gfg",
    ingredients: [
      { id: "i1", name: "Queso crema Philadelphia", quantity: 0.60, unit: "kg", unitCost: 8.50, totalCost: 5.10 },
      { id: "i2", name: "Huevos de campo", quantity: 4, unit: "unid", unitCost: 0.25, totalCost: 1.00 },
      { id: "i3", name: "Crema para batir 35%", quantity: 0.35, unit: "L", unitCost: 4.80, totalCost: 1.68 },
      { id: "i4", name: "Azúcar refinada", quantity: 0.20, unit: "kg", unitCost: 1.80, totalCost: 0.36 },
      { id: "i5", name: "Fresas frescas huerto", quantity: 0.30, unit: "kg", unitCost: 5.20, totalCost: 1.56 },
      { id: "i6", name: "Caja kraft premium", quantity: 1, unit: "kit", unitCost: 1.50, totalCost: 1.50 }
    ],
    indirectCost: 2.50,
    targetMargin: 58,
    suggestedPrice: 28.00,
    actualPrice: 28.00,
    instructions: [
      "Mezclar el queso crema a temperatura ambiente con azúcar hasta tener textura sedosa.",
      "Añadir los huevos de a uno sin sobrebatir.",
      "Incorporar la crema de leche y una cucharada de harina.",
      "Hornear a 210°C por 40 minutos hasta lograr la superficie tostada característica.",
      "Refrigerar mínimo 6 horas antes de servir con el coulis de fresas frescas."
    ]
  },
  {
    id: "rec-pavlova",
    code: "#015",
    name: "Pavlova de Frutos Rojos (Cero Mermas)",
    category: "Postres",
    bestseller: false,
    portions: 8,
    prepTime: "1h 30m",
    difficulty: "Media",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBNE-784HDJXB4kNP35FAQXvEwhuHkObvuW2SgU9tFfVE257l77KBRGI9Gg2zH1aeQzh3KINefMhOB5qhWFPMDT5btArKRjdgNVjjenJjJm_dn2COcCYGFjHYivh90FQEosh3nftZGQld4Edw0ydn6KOSanlyPNnxWeBL3Tq2DtufodUOpMW8aEsXsFpY57BsJREZA8K-h3dTlEbGiku3qIiO6JjcZ4_H5Gkb0qLg",
    ingredients: [
      { id: "i1", name: "Claras de huevo (sobrantes)", quantity: 6, unit: "unid", unitCost: 0.10, totalCost: 0.60 },
      { id: "i2", name: "Azúcar glas", quantity: 0.30, unit: "kg", unitCost: 1.80, totalCost: 0.54 },
      { id: "i3", name: "Fresas maduras", quantity: 0.40, unit: "kg", unitCost: 5.20, totalCost: 2.08 },
      { id: "i4", name: "Crema chantilly", quantity: 0.25, unit: "L", unitCost: 4.80, totalCost: 1.20 },
      { id: "i5", name: "Bases individuales", quantity: 8, unit: "unid", unitCost: 0.20, totalCost: 1.60 }
    ],
    indirectCost: 2.00,
    targetMargin: 74,
    suggestedPrice: 4.50, // por porción ($36 el lote)
    actualPrice: 4.50,
    instructions: [
      "Montar las claras a punto de nieve e incorporar azúcar en lluvia hasta merengue firme.",
      "Formar nidos en bandeja con papel encerado.",
      "Secar en horno a 100°C por 75 minutos.",
      "Rellenar con chantilly y coronar con las fresas maceradas."
    ]
  },
  {
    id: "rec-croissant",
    code: "#008",
    name: "Croissant de Mantequilla Francés",
    category: "Masas",
    bestseller: false,
    portions: 12,
    prepTime: "4h 00m",
    difficulty: "Alta",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC5SaRNBTOP1mUc2qrzbxq670soQBiefsSyD-hsk34UiMk_o9gm0yu64W2BXRPc7W6WVq5eSE9QcsuSZF7Wbh4V04Q63ZXtvPXVI5unVMw2-r4T1ZpsPwUL0btcC_DuJBdoyHV31YJ0Ut-j_CQO7yl3lNPiHci9_c-TDKX6SEtotyL633bQ6-XxYmlixxg0irbegGW5C-TZn5PHU3gafOMrgneEhO5d0fLFTdzNGw",
    ingredients: [
      { id: "i1", name: "Harina de fuerza", quantity: 0.50, unit: "kg", unitCost: 2.20, totalCost: 1.10 },
      { id: "i2", name: "Mantequilla 82% laminado", quantity: 0.30, unit: "kg", unitCost: 10.00, totalCost: 3.00 },
      { id: "i3", name: "Levadura fresca", quantity: 0.02, unit: "kg", unitCost: 8.00, totalCost: 0.16 },
      { id: "i4", name: "Leche entera", quantity: 0.25, unit: "L", unitCost: 1.20, totalCost: 0.30 },
      { id: "i5", name: "Empaque panadería", quantity: 12, unit: "unid", unitCost: 0.10, totalCost: 1.20 }
    ],
    indirectCost: 4.50,
    targetMargin: 52,
    suggestedPrice: 3.80,
    actualPrice: 3.80,
    instructions: [
      "Amasar el détrempe y dejar reposar en frío por 2 horas.",
      "Laminar el bloque de mantequilla al centro con 3 vueltas simples.",
      "Cortar triángulos uniformes y enrollar suavemente.",
      "Fermentar a 26°C por 2 horas y hornear a 195°C durante 18 minutos."
    ]
  },
  {
    id: "rec-redvelvet",
    code: "#023",
    name: "Pastel Red Velvet Clásico",
    category: "Tortas",
    bestseller: true,
    portions: 8,
    prepTime: "2h 10m",
    difficulty: "Media",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAEjgP9WLGhKmmRngYIvpMy5bizc9gvxS7KvmL8ZSYsRyFgm1Wb--rtADIk1OAqLC5weD7EMfY0jpdq-yi4fn2vHxTl_en-_GA-s67Pmn-xiaYdHK61dPk8ubiOmydhDL4aqHLOziZqjInpsY8xQsKlvRuC0mi9Aj30W_M6ErqflejfA26jxBQao_NqIPO7JRvIqq-ZoI3fdM15aalvDb9n6ObkQy_iJYLsA9_cQQ",
    ingredients: [
      { id: "i1", name: "Harina pastelera", quantity: 0.35, unit: "kg", unitCost: 2.00, totalCost: 0.70 },
      { id: "i2", name: "Cacao alcalinizado", quantity: 0.05, unit: "kg", unitCost: 12.00, totalCost: 0.60 },
      { id: "i3", name: "Mantequilla pomada", quantity: 0.18, unit: "kg", unitCost: 10.00, totalCost: 1.80 },
      { id: "i4", name: "Queso crema frosting", quantity: 0.40, unit: "kg", unitCost: 8.50, totalCost: 3.40 },
      { id: "i5", name: "Huevos", quantity: 3, unit: "unid", unitCost: 0.25, totalCost: 0.75 },
      { id: "i6", name: "Colorante rojo en gel & vainilla", quantity: 1, unit: "kit", unitCost: 0.80, totalCost: 0.80 },
      { id: "i7", name: "Caja y base", quantity: 1, unit: "kit", unitCost: 1.40, totalCost: 1.40 }
    ],
    indirectCost: 2.35,
    targetMargin: 58,
    suggestedPrice: 28.00,
    actualPrice: 28.00,
    instructions: [
      "Cremar mantequilla con azúcar hasta punto pálido.",
      "Integrar huevos uno a uno alternando con buttermilk teñido.",
      "Añadir harina y cacao tamizados con espátula.",
      "Activar bicarbonato con vinagre e incorporar de inmediato.",
      "Hornear a 170°C por 30 minutos y cubrir con frosting de queso crema."
    ]
  }
];

export const INITIAL_INVOICES = [
  {
    id: "FAC-00101",
    type: "factura", // factura o ticket
    customerName: "Mariana Silva Ruiz",
    customerDoc: "17928374-2",
    date: "2026-11-03 16:45",
    items: [
      { productId: "p6", name: "Pastel Selva Negra Especial 20cm", quantity: 1, price: 34.75, total: 34.75 },
      { productId: "p5", name: "Macarons Surtidos (Caja 6)", quantity: 2, price: 14.00, total: 28.00 }
    ],
    subtotal: 62.75,
    discountPercent: 5,
    discountAmount: 3.14,
    tip: 2.00,
    total: 61.61,
    paymentMethod: "Tarjeta de Crédito",
    status: "Pagada",
    notes: "Entregar con vela de cumpleaños dorada"
  },
  {
    id: "TIK-00234",
    type: "ticket",
    customerName: "Cliente de Mostrador",
    customerDoc: "CF",
    date: "2026-11-03 17:15",
    items: [
      { productId: "p2", name: "Cupcake de Vainilla & Cereza", quantity: 3, price: 3.50, total: 10.50 },
      { productId: "p10", name: "Café Latte Especial de la Casa", quantity: 2, price: 3.50, total: 7.00 }
    ],
    subtotal: 17.50,
    discountPercent: 0,
    discountAmount: 0.00,
    tip: 1.00,
    total: 18.50,
    paymentMethod: "Efectivo",
    status: "Pagada",
    notes: ""
  },
  {
    id: "FAC-00102",
    type: "factura",
    customerName: "Café & Bistró Lumière",
    customerDoc: "20491823901",
    date: "2026-11-02 11:20",
    items: [
      { productId: "p8", name: "Croissant Francés de Mantequilla", quantity: 24, price: 3.80, total: 91.20 },
      { productId: "p4", name: "Galletas Chispas Chocolate (x6)", quantity: 6, price: 7.50, total: 45.00 }
    ],
    subtotal: 136.20,
    discountPercent: 10,
    discountAmount: 13.62,
    tip: 0.00,
    total: 122.58,
    paymentMethod: "Transferencia Bancaria",
    status: "Pagada",
    notes: "Pedido institucional matutino"
  },
  {
    id: "FAC-00103",
    type: "factura",
    customerName: "Carlos Méndez Soto",
    customerDoc: "12847192-K",
    date: "2026-11-03 19:30",
    items: [
      { productId: "p1", name: "Pastel Red Velvet (8 porc.)", quantity: 1, price: 28.00, total: 28.00 }
    ],
    subtotal: 28.00,
    discountPercent: 0,
    discountAmount: 0.00,
    tip: 2.00,
    total: 30.00,
    paymentMethod: "WhatsApp / Zelle",
    status: "Pendiente",
    notes: "Recoge mañana 10am"
  }
];

export const INITIAL_SETTINGS = {
  storeName: "Sweet Smile Pastry & Bakery",
  tagline: "Repostería Fina & Obrador Artesanal",
  whatsappNumber: "+18095551234",
  currency: "$",
  githubPagesUrl: "https://usuario.github.io/my-app/catalog.html",
  cloudSyncEnabled: true,
  lastSync: new Date().toISOString(),
  offlineMode: false,
  notificationAlerts: true
};
