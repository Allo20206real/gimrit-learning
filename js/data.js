// Course content. Translations are listed in LANG_ORDER: es | fr | de | it | pt
export const LANG_ORDER = ['es', 'fr', 'de', 'it', 'pt'];

export const LANGS = {
  es: { name: 'Spanish', native: 'Español', flag: '🇪🇸', tts: 'es-ES', chars: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'] },
  fr: { name: 'French', native: 'Français', flag: '🇫🇷', tts: 'fr-FR', chars: ['à', 'â', 'ç', 'é', 'è', 'ê', 'ë', 'î', 'ô', 'ù', 'û', 'œ'] },
  de: { name: 'German', native: 'Deutsch', flag: '🇩🇪', tts: 'de-DE', chars: ['ä', 'ö', 'ü', 'ß'] },
  it: { name: 'Italian', native: 'Italiano', flag: '🇮🇹', tts: 'it-IT', chars: ['à', 'è', 'é', 'ì', 'ò', 'ù'] },
  pt: { name: 'Portuguese', native: 'Português', flag: '🇧🇷', tts: 'pt-BR', chars: ['á', 'â', 'ã', 'à', 'ç', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú'] },
};

const split = (s) => {
  const parts = s.split('|');
  return Object.fromEntries(LANG_ORDER.map((l, i) => [l, parts[i]]));
};
const w = (id, en, e, t) => ({ id, en, e, t: split(t) });
const s = (en, t) => ({ en, t: split(t) });

export const UNITS = [
  {
    id: 'greet', title: 'Greetings', desc: 'Say hello and be polite', icon: '👋', color: '#7c5cff', pic: false,
    tip: 'Polite words open every door. Notice how "please" and "thank you" are often the first phrases locals appreciate hearing from visitors.',
    words: [
      w('hello', 'hello', '👋', 'hola|bonjour|hallo|ciao|olá'),
      w('bye', 'goodbye', '✌️', 'adiós|au revoir|tschüss|arrivederci|tchau'),
      w('yes', 'yes', '👍', 'sí|oui|ja|sì|sim'),
      w('no', 'no', '👎', 'no|non|nein|no|não'),
      w('please', 'please', '🙏', 'por favor|s\'il vous plaît|bitte|per favore|por favor'),
      w('thanks', 'thank you', '💐', 'gracias|merci|danke|grazie|obrigado'),
      w('night', 'good night', '🌙', 'buenas noches|bonne nuit|gute Nacht|buona notte|boa noite'),
      w('sorry', 'sorry', '😔', 'lo siento|désolé|Entschuldigung|mi dispiace|desculpe'),
    ],
    sentences: [
      s('Hello, how are you?', 'Hola, ¿cómo estás?|Bonjour, comment ça va?|Hallo, wie geht es dir?|Ciao, come stai?|Olá, como vai você?'),
      s('Yes, please.', 'Sí, por favor.|Oui, s\'il vous plaît.|Ja, bitte.|Sì, per favore.|Sim, por favor.'),
      s('No, thank you.', 'No, gracias.|Non, merci.|Nein, danke.|No, grazie.|Não, obrigado.'),
      s('My name is Ana.', 'Me llamo Ana.|Je m\'appelle Ana.|Ich heiße Ana.|Mi chiamo Ana.|Meu nome é Ana.'),
    ],
  },
  {
    id: 'food', title: 'Food & Drink', desc: 'Order like a local', icon: '🍎', color: '#ff7a45', pic: true,
    tip: 'Most nouns come with a gendered article (like "el/la", "le/la", "der/die/das"). Learn the article together with the word — it pays off later.',
    words: [
      w('apple', 'apple', '🍎', 'la manzana|la pomme|der Apfel|la mela|a maçã'),
      w('bread', 'bread', '🍞', 'el pan|le pain|das Brot|il pane|o pão'),
      w('water', 'water', '💧', 'el agua|l\'eau|das Wasser|l\'acqua|a água'),
      w('cheese', 'cheese', '🧀', 'el queso|le fromage|der Käse|il formaggio|o queijo'),
      w('coffee', 'coffee', '☕', 'el café|le café|der Kaffee|il caffè|o café'),
      w('milk', 'milk', '🥛', 'la leche|le lait|die Milch|il latte|o leite'),
      w('egg', 'egg', '🥚', 'el huevo|l\'œuf|das Ei|l\'uovo|o ovo'),
      w('soup', 'soup', '🍲', 'la sopa|la soupe|die Suppe|la zuppa|a sopa'),
    ],
    sentences: [
      s('I drink water.', 'Bebo agua.|Je bois de l\'eau.|Ich trinke Wasser.|Bevo acqua.|Eu bebo água.'),
      s('The bread is good.', 'El pan es bueno.|Le pain est bon.|Das Brot ist gut.|Il pane è buono.|O pão é bom.'),
      s('I eat an apple.', 'Como una manzana.|Je mange une pomme.|Ich esse einen Apfel.|Mangio una mela.|Eu como uma maçã.'),
      s('A coffee with milk, please.', 'Un café con leche, por favor.|Un café au lait, s\'il vous plaît.|Einen Kaffee mit Milch, bitte.|Un caffè con latte, per favore.|Um café com leite, por favor.'),
    ],
  },
  {
    id: 'animals', title: 'Animals', desc: 'Meet furry (and feathery) friends', icon: '🐶', color: '#20b26b', pic: true,
    tip: 'Adjectives like "big" and "small" often change their ending to match the noun\'s gender. Watch the endings in the example sentences.',
    words: [
      w('dog', 'dog', '🐶', 'el perro|le chien|der Hund|il cane|o cachorro'),
      w('cat', 'cat', '🐱', 'el gato|le chat|die Katze|il gatto|o gato'),
      w('bird', 'bird', '🐦', 'el pájaro|l\'oiseau|der Vogel|l\'uccello|o pássaro'),
      w('horse', 'horse', '🐴', 'el caballo|le cheval|das Pferd|il cavallo|o cavalo'),
      w('fish', 'fish', '🐟', 'el pez|le poisson|der Fisch|il pesce|o peixe'),
      w('cow', 'cow', '🐮', 'la vaca|la vache|die Kuh|la mucca|a vaca'),
      w('mouse', 'mouse', '🐭', 'el ratón|la souris|die Maus|il topo|o rato'),
      w('bear', 'bear', '🐻', 'el oso|l\'ours|der Bär|l\'orso|o urso'),
    ],
    sentences: [
      s('The dog is big.', 'El perro es grande.|Le chien est grand.|Der Hund ist groß.|Il cane è grande.|O cachorro é grande.'),
      s('The cat drinks milk.', 'El gato bebe leche.|Le chat boit du lait.|Die Katze trinkt Milch.|Il gatto beve il latte.|O gato bebe leite.'),
      s('I have a horse.', 'Tengo un caballo.|J\'ai un cheval.|Ich habe ein Pferd.|Ho un cavallo.|Eu tenho um cavalo.'),
      s('The bird is small.', 'El pájaro es pequeño.|L\'oiseau est petit.|Der Vogel ist klein.|L\'uccello è piccolo.|O pássaro é pequeno.'),
    ],
  },
  {
    id: 'family', title: 'Family', desc: 'Talk about the people you love', icon: '👨‍👩‍👧', color: '#ff4f8b', pic: true,
    tip: 'Possessives ("my", "your") usually agree with the thing owned, not the owner. In Italian, you even add an article: "il mio amico".',
    words: [
      w('mother', 'mother', '👩', 'la madre|la mère|die Mutter|la madre|a mãe'),
      w('father', 'father', '👨', 'el padre|le père|der Vater|il padre|o pai'),
      w('sister', 'sister', '👧', 'la hermana|la sœur|die Schwester|la sorella|a irmã'),
      w('brother', 'brother', '👦', 'el hermano|le frère|der Bruder|il fratello|o irmão'),
      w('baby', 'baby', '👶', 'el bebé|le bébé|das Baby|il bebè|o bebê'),
      w('grandma', 'grandmother', '👵', 'la abuela|la grand-mère|die Großmutter|la nonna|a avó'),
      w('grandpa', 'grandfather', '👴', 'el abuelo|le grand-père|der Großvater|il nonno|o avô'),
      w('friend', 'friend', '🧑‍🤝‍🧑', 'el amigo|l\'ami|der Freund|l\'amico|o amigo'),
    ],
    sentences: [
      s('This is my mother.', 'Esta es mi madre.|C\'est ma mère.|Das ist meine Mutter.|Questa è mia madre.|Esta é minha mãe.'),
      s('My brother is tall.', 'Mi hermano es alto.|Mon frère est grand.|Mein Bruder ist groß.|Mio fratello è alto.|Meu irmão é alto.'),
      s('I love my family.', 'Amo a mi familia.|J\'aime ma famille.|Ich liebe meine Familie.|Amo la mia famiglia.|Eu amo minha família.'),
      s('My friend has a cat.', 'Mi amigo tiene un gato.|Mon ami a un chat.|Mein Freund hat eine Katze.|Il mio amico ha un gatto.|Meu amigo tem um gato.'),
    ],
  },
  {
    id: 'colors', title: 'Colors', desc: 'Paint the world with words', icon: '🎨', color: '#1fa2ff', pic: true,
    tip: 'In Spanish, French, Italian and Portuguese, color adjectives usually come after the noun: "un gato negro", "un chat noir".',
    words: [
      w('red', 'red', '🟥', 'rojo|rouge|rot|rosso|vermelho'),
      w('blue', 'blue', '🟦', 'azul|bleu|blau|blu|azul'),
      w('green', 'green', '🟩', 'verde|vert|grün|verde|verde'),
      w('yellow', 'yellow', '🟨', 'amarillo|jaune|gelb|giallo|amarelo'),
      w('black', 'black', '⬛', 'negro|noir|schwarz|nero|preto'),
      w('white', 'white', '⬜', 'blanco|blanc|weiß|bianco|branco'),
      w('orange', 'orange', '🟧', 'naranja|orange|orange|arancione|laranja'),
      w('purple', 'purple', '🟪', 'morado|violet|lila|viola|roxo'),
    ],
    sentences: [
      s('The apple is red.', 'La manzana es roja.|La pomme est rouge.|Der Apfel ist rot.|La mela è rossa.|A maçã é vermelha.'),
      s('The sky is blue.', 'El cielo es azul.|Le ciel est bleu.|Der Himmel ist blau.|Il cielo è blu.|O céu é azul.'),
      s('I have a black cat.', 'Tengo un gato negro.|J\'ai un chat noir.|Ich habe eine schwarze Katze.|Ho un gatto nero.|Eu tenho um gato preto.'),
      s('My favorite color is green.', 'Mi color favorito es el verde.|Ma couleur préférée est le vert.|Meine Lieblingsfarbe ist Grün.|Il mio colore preferito è il verde.|Minha cor favorita é verde.'),
    ],
  },
  {
    id: 'numbers', title: 'Numbers', desc: 'Count from one to eight', icon: '🔢', color: '#f5b400', pic: true,
    tip: 'To say your age, most of these languages say you "have" years — "Tengo ocho años", "J\'ai huit ans". German uses "to be": "Ich bin acht Jahre alt".',
    words: [
      w('one', 'one', '1️⃣', 'uno|un|eins|uno|um'),
      w('two', 'two', '2️⃣', 'dos|deux|zwei|due|dois'),
      w('three', 'three', '3️⃣', 'tres|trois|drei|tre|três'),
      w('four', 'four', '4️⃣', 'cuatro|quatre|vier|quattro|quatro'),
      w('five', 'five', '5️⃣', 'cinco|cinq|fünf|cinque|cinco'),
      w('six', 'six', '6️⃣', 'seis|six|sechs|sei|seis'),
      w('seven', 'seven', '7️⃣', 'siete|sept|sieben|sette|sete'),
      w('eight', 'eight', '8️⃣', 'ocho|huit|acht|otto|oito'),
    ],
    sentences: [
      s('I have two brothers.', 'Tengo dos hermanos.|J\'ai deux frères.|Ich habe zwei Brüder.|Ho due fratelli.|Eu tenho dois irmãos.'),
      s('Three coffees, please.', 'Tres cafés, por favor.|Trois cafés, s\'il vous plaît.|Drei Kaffee, bitte.|Tre caffè, per favore.|Três cafés, por favor.'),
      s('She has five cats.', 'Ella tiene cinco gatos.|Elle a cinq chats.|Sie hat fünf Katzen.|Lei ha cinque gatti.|Ela tem cinco gatos.'),
      s('I am eight years old.', 'Tengo ocho años.|J\'ai huit ans.|Ich bin acht Jahre alt.|Ho otto anni.|Eu tenho oito anos.'),
    ],
  },
  {
    id: 'travel', title: 'Travel', desc: 'Find your way around town', icon: '✈️', color: '#00b8a9', pic: true,
    tip: '"Where is…?" is the traveller\'s superpower: ¿Dónde está…? / Où est…? / Wo ist…? / Dov\'è…? / Onde fica…?',
    words: [
      w('airport', 'airport', '🛫', 'el aeropuerto|l\'aéroport|der Flughafen|l\'aeroporto|o aeroporto'),
      w('train', 'train', '🚆', 'el tren|le train|der Zug|il treno|o trem'),
      w('hotel', 'hotel', '🏨', 'el hotel|l\'hôtel|das Hotel|l\'albergo|o hotel'),
      w('beach', 'beach', '🏖️', 'la playa|la plage|der Strand|la spiaggia|a praia'),
      w('ticket', 'ticket', '🎫', 'el billete|le billet|die Fahrkarte|il biglietto|a passagem'),
      w('city', 'city', '🏙️', 'la ciudad|la ville|die Stadt|la città|a cidade'),
      w('street', 'street', '🛣️', 'la calle|la rue|die Straße|la strada|a rua'),
      w('car', 'car', '🚗', 'el coche|la voiture|das Auto|la macchina|o carro'),
    ],
    sentences: [
      s('Where is the hotel?', '¿Dónde está el hotel?|Où est l\'hôtel?|Wo ist das Hotel?|Dov\'è l\'albergo?|Onde fica o hotel?'),
      s('A ticket, please.', 'Un billete, por favor.|Un billet, s\'il vous plaît.|Eine Fahrkarte, bitte.|Un biglietto, per favore.|Uma passagem, por favor.'),
      s('The train is late.', 'El tren llega tarde.|Le train est en retard.|Der Zug hat Verspätung.|Il treno è in ritardo.|O trem está atrasado.'),
      s('We go to the beach.', 'Vamos a la playa.|Nous allons à la plage.|Wir gehen zum Strand.|Andiamo in spiaggia.|Nós vamos à praia.'),
    ],
  },
  {
    id: 'home', title: 'At Home', desc: 'Everyday things around you', icon: '🏠', color: '#9b59ff', pic: true,
    tip: 'Location words like "on" combine with articles in German and Italian: "auf dem Tisch", "sul tavolo" (su + il).',
    words: [
      w('house', 'house', '🏠', 'la casa|la maison|das Haus|la casa|a casa'),
      w('book', 'book', '📖', 'el libro|le livre|das Buch|il libro|o livro'),
      w('phone', 'phone', '📱', 'el teléfono|le téléphone|das Telefon|il telefono|o telefone'),
      w('bed', 'bed', '🛏️', 'la cama|le lit|das Bett|il letto|a cama'),
      w('table', 'table', '🍽️', 'la mesa|la table|der Tisch|il tavolo|a mesa'),
      w('door', 'door', '🚪', 'la puerta|la porte|die Tür|la porta|a porta'),
      w('key', 'key', '🔑', 'la llave|la clé|der Schlüssel|la chiave|a chave'),
      w('lamp', 'lamp', '💡', 'la lámpara|la lampe|die Lampe|la lampada|a lâmpada'),
    ],
    sentences: [
      s('The house is big.', 'La casa es grande.|La maison est grande.|Das Haus ist groß.|La casa è grande.|A casa é grande.'),
      s('I read a book.', 'Leo un libro.|Je lis un livre.|Ich lese ein Buch.|Leggo un libro.|Eu leio um livro.'),
      s('Where is my key?', '¿Dónde está mi llave?|Où est ma clé?|Wo ist mein Schlüssel?|Dov\'è la mia chiave?|Onde está minha chave?'),
      s('The phone is on the table.', 'El teléfono está en la mesa.|Le téléphone est sur la table.|Das Telefon ist auf dem Tisch.|Il telefono è sul tavolo.|O telefone está na mesa.'),
    ],
  },
];

// Lesson plan used for every unit
export const LESSONS = [
  { kind: 'words', range: [0, 4], title: 'New words I' },
  { kind: 'words', range: [4, 8], title: 'New words II' },
  { kind: 'sentences', title: 'Phrases' },
  { kind: 'review', title: 'Practice' },
  { kind: 'challenge', title: 'Unit challenge' },
];

const line = (who, en, t) => ({ who, en, t: split(t) });

export const STORIES = [
  {
    id: 'cafe', title: 'At the Café', icon: '☕', unlock: 1, cast: { A: '🧑‍🍳', B: '👩' },
    lines: [
      line('A', 'Hello! What would you like?', '¡Hola! ¿Qué desea?|Bonjour! Que désirez-vous?|Hallo! Was möchten Sie?|Buongiorno! Cosa desidera?|Olá! O que deseja?'),
      line('B', 'A coffee with milk, please.', 'Un café con leche, por favor.|Un café au lait, s\'il vous plaît.|Einen Kaffee mit Milch, bitte.|Un caffè con latte, per favore.|Um café com leite, por favor.'),
      line('A', 'Anything else?', '¿Algo más?|Autre chose?|Sonst noch etwas?|Altro?|Mais alguma coisa?'),
      line('B', 'Yes, bread with cheese.', 'Sí, pan con queso.|Oui, du pain avec du fromage.|Ja, Brot mit Käse.|Sì, pane con formaggio.|Sim, pão com queijo.'),
      line('A', 'Here you go!', '¡Aquí tiene!|Voilà!|Bitte schön!|Ecco a lei!|Aqui está!'),
      line('B', 'Thank you very much!', '¡Muchas gracias!|Merci beaucoup!|Vielen Dank!|Grazie mille!|Muito obrigada!'),
    ],
    questions: [
      { after: 1, q: 'What does she want to drink?', options: ['Coffee with milk', 'A glass of water', 'Tea'], a: 0 },
      { after: 3, q: 'What else does she order?', options: ['Soup', 'Bread with cheese', 'An apple'], a: 1 },
    ],
  },
  {
    id: 'key', title: 'The Lost Key', icon: '🔑', unlock: 3, cast: { A: '🧔', B: '👧' },
    lines: [
      line('A', 'Where is my key?', '¿Dónde está mi llave?|Où est ma clé?|Wo ist mein Schlüssel?|Dov\'è la mia chiave?|Onde está minha chave?'),
      line('B', 'Is it on the table?', '¿Está en la mesa?|Elle est sur la table?|Ist er auf dem Tisch?|È sul tavolo?|Está na mesa?'),
      line('A', 'No, it is not there.', 'No, no está allí.|Non, elle n\'est pas là.|Nein, da ist er nicht.|No, non c\'è.|Não, não está lá.'),
      line('B', 'Look! The cat has the key!', '¡Mira! ¡El gato tiene la llave!|Regarde! Le chat a la clé!|Schau! Die Katze hat den Schlüssel!|Guarda! Il gatto ha la chiave!|Olha! O gato está com a chave!'),
      line('A', 'Bad cat! Thank you!', '¡Gato malo! ¡Gracias!|Méchant chat! Merci!|Böse Katze! Danke!|Gatto cattivo! Grazie!|Gato malvado! Obrigado!'),
    ],
    questions: [
      { after: 0, q: 'What is he looking for?', options: ['His phone', 'His book', 'His key'], a: 2 },
      { after: 3, q: 'Who has the key?', options: ['The cat', 'The dog', 'The girl'], a: 0 },
    ],
  },
  {
    id: 'station', title: 'At the Station', icon: '🚆', unlock: 6, cast: { A: '👩‍🦰', B: '🧑‍💼' },
    lines: [
      line('A', 'Hello! A ticket, please.', '¡Hola! Un billete, por favor.|Bonjour! Un billet, s\'il vous plaît.|Hallo! Eine Fahrkarte, bitte.|Buongiorno! Un biglietto, per favore.|Olá! Uma passagem, por favor.'),
      line('B', 'Where are you going?', '¿Adónde va?|Où allez-vous?|Wohin fahren Sie?|Dove va?|Para onde vai?'),
      line('A', 'To the beach!', '¡A la playa!|À la plage!|Zum Strand!|Al mare!|Para a praia!'),
      line('B', 'The train is late.', 'El tren llega tarde.|Le train est en retard.|Der Zug hat Verspätung.|Il treno è in ritardo.|O trem está atrasado.'),
      line('A', 'No problem. I have a book.', 'No hay problema. Tengo un libro.|Pas de problème. J\'ai un livre.|Kein Problem. Ich habe ein Buch.|Nessun problema. Ho un libro.|Sem problema. Eu tenho um livro.'),
    ],
    questions: [
      { after: 2, q: 'Where is she going?', options: ['The airport', 'The beach', 'The hotel'], a: 1 },
      { after: 3, q: 'What is the problem?', options: ['The train is late', 'There are no tickets', 'It is raining'], a: 0 },
      { after: 4, q: 'What will she do while waiting?', options: ['Drink coffee', 'Call a friend', 'Read a book'], a: 2 },
    ],
  },
];

export const AVATARS = ['🦊', '🐼', '🐸', '🐯', '🐨', '🐙', '🦉', '🐧', '🐵', '🐰', '🦁', '🐳'];
export const PREMIUM_AVATARS = [
  { id: 'unicorn', e: '🦄', price: 400 },
  { id: 'dragon', e: '🐉', price: 600 },
  { id: 'robot', e: '🤖', price: 400 },
  { id: 'alien', e: '👽', price: 500 },
  { id: 'crown', e: '👑', price: 1000 },
];
export const COLORS = ['#7c5cff', '#ff7a45', '#20b26b', '#ff4f8b', '#1fa2ff', '#f5b400', '#00b8a9', '#9b59ff'];

export const THEMES = [
  { id: 'violet', name: 'Gimrit Violet', accent: '#7c5cff', accent2: '#ff7a45', price: 0 },
  { id: 'ocean', name: 'Deep Ocean', accent: '#1a8cff', accent2: '#00c2a8', price: 300 },
  { id: 'sunset', name: 'Sunset', accent: '#ff5a5f', accent2: '#ffb400', price: 300 },
  { id: 'forest', name: 'Forest', accent: '#1f9d55', accent2: '#c0d72f', price: 300 },
  { id: 'candy', name: 'Cotton Candy', accent: '#e255c9', accent2: '#4dc3ff', price: 500 },
];

export const allWords = () => UNITS.flatMap((u, ui) => u.words.map((wd) => ({ ...wd, unit: ui })));
export const allSentences = () => UNITS.flatMap((u, ui) => u.sentences.map((st, si) => ({ ...st, unit: ui, id: `${u.id}:${si}` })));
