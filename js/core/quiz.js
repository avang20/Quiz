/* =========================================================
   QuizDuo - Quiz Questions
   123 Questions
   8 Stages
   ========================================================= */

const generalQuestions = [

  /* =======================================================
     STAGE 1 — 15 QUESTIONS
  ======================================================= */

  {
    id: "general-1-1",
    stage: 1,
    question: "Which planet is known as the Red Planet?",
    options: [
      "Mars",
      "Venus",
      "Jupiter",
      "Mercury"
    ],
    correctIndex: 0
  },

  {
    id: "general-1-2",
    stage: 1,
    question: "What is the largest planet in the Solar System?",
    options: [
      "Saturn",
      "Jupiter",
      "Neptune",
      "Earth"
    ],
    correctIndex: 1
  },

  {
    id: "general-1-3",
    stage: 1,
    question: "What is the largest ocean on Earth?",
    options: [
      "Atlantic Ocean",
      "Indian Ocean",
      "Pacific Ocean",
      "Arctic Ocean"
    ],
    correctIndex: 2
  },

  {
    id: "general-1-4",
    stage: 1,
    question: "What is the highest mountain above sea level?",
    options: [
      "K2",
      "Mount Everest",
      "Kangchenjunga",
      "Mont Blanc"
    ],
    correctIndex: 1
  },

  {
    id: "general-1-5",
    stage: 1,
    question: "What is the main language spoken in Brazil?",
    options: [
      "Spanish",
      "Portuguese",
      "French",
      "Italian"
    ],
    correctIndex: 1
  },

  {
    id: "general-1-6",
    stage: 1,
    question: "Which country is known as the Land of the Rising Sun?",
    options: [
      "China",
      "South Korea",
      "Japan",
      "Thailand"
    ],
    correctIndex: 2
  },

  {
    id: "general-1-7",
    stage: 1,
    question: "What is the capital of Italy?",
    options: [
      "Milan",
      "Venice",
      "Naples",
      "Rome"
    ],
    correctIndex: 3
  },

  {
    id: "general-1-8",
    stage: 1,
    question: "At what temperature does water freeze?",
    options: [
      "0°C",
      "10°C",
      "32°C",
      "100°C"
    ],
    correctIndex: 0
  },

  {
    id: "general-1-9",
    stage: 1,
    question: "Which bird is commonly used as a symbol of peace?",
    options: [
      "Eagle",
      "Dove",
      "Owl",
      "Swan"
    ],
    correctIndex: 1
  },

  {
    id: "general-1-10",
    stage: 1,
    question: "What is the capital of Germany?",
    options: [
      "Munich",
      "Hamburg",
      "Berlin",
      "Frankfurt"
    ],
    correctIndex: 2
  },

  {
    id: "general-1-11",
    stage: 1,
    question: "Which animal is known as the 'ship of the desert'?",
    options: [
      "Horse",
      "Camel",
      "Elephant",
      "Donkey"
    ],
    correctIndex: 1
  },

  {
    id: "general-1-12",
    stage: 1,
    question: "What is the capital of Turkey?",
    options: [
      "Istanbul",
      "Izmir",
      "Ankara",
      "Bursa"
    ],
    correctIndex: 2
  },

  {
    id: "general-1-13",
    stage: 1,
    question: "What is the capital of Australia?",
    options: [
      "Sydney",
      "Melbourne",
      "Perth",
      "Canberra"
    ],
    correctIndex: 3
  },

  {
    id: "general-1-14",
    stage: 1,
    question: "What is the hardest natural substance?",
    options: [
      "Gold",
      "Iron",
      "Diamond",
      "Quartz"
    ],
    correctIndex: 2
  },

  {
    id: "general-1-15",
    stage: 1,
    question: "What is the most abundant gas in Earth's atmosphere?",
    options: [
      "Oxygen",
      "Nitrogen",
      "Carbon dioxide",
      "Hydrogen"
    ],
    correctIndex: 1
  },


  /* =======================================================
     STAGE 2 — 15 QUESTIONS
  ======================================================= */

  {
    id: "general-2-1",
    stage: 2,
    question: "What is the longest bone in the human body?",
    options: [
      "Tibia",
      "Femur",
      "Humerus",
      "Radius"
    ],
    correctIndex: 1
  },

  {
    id: "general-2-2",
    stage: 2,
    question: "Who wrote Romeo and Juliet?",
    options: [
      "William Shakespeare",
      "Charles Dickens",
      "Jane Austen",
      "Mark Twain"
    ],
    correctIndex: 0
  },

  {
    id: "general-2-3",
    stage: 2,
    question: "Who painted the Mona Lisa?",
    options: [
      "Michelangelo",
      "Leonardo da Vinci",
      "Raphael",
      "Vincent van Gogh"
    ],
    correctIndex: 1
  },

  {
    id: "general-2-4",
    stage: 2,
    question: "Which artist famously cut off part of his own ear?",
    options: [
      "Pablo Picasso",
      "Claude Monet",
      "Vincent van Gogh",
      "Salvador Dalí"
    ],
    correctIndex: 2
  },

  {
    id: "general-2-5",
    stage: 2,
    question: "Which natural disaster is commonly associated with the Richter scale?",
    options: [
      "Hurricane",
      "Earthquake",
      "Tornado",
      "Flood"
    ],
    correctIndex: 1
  },

  {
    id: "general-2-6",
    stage: 2,
    question: "What is the largest internal organ in the human body?",
    options: [
      "Liver",
      "Lung",
      "Heart",
      "Kidney"
    ],
    correctIndex: 0
  },

  {
    id: "general-2-7",
    stage: 2,
    question: "Which organ produces insulin?",
    options: [
      "Liver",
      "Pancreas",
      "Kidney",
      "Stomach"
    ],
    correctIndex: 1
  },

  {
    id: "general-2-8",
    stage: 2,
    question: "What is the capital of Canada?",
    options: [
      "Toronto",
      "Vancouver",
      "Montreal",
      "Ottawa"
    ],
    correctIndex: 3
  },

  {
    id: "general-2-9",
    stage: 2,
    question: "What is the smallest country in the world?",
    options: [
      "Monaco",
      "Vatican City",
      "San Marino",
      "Liechtenstein"
    ],
    correctIndex: 1
  },

  {
    id: "general-2-10",
    stage: 2,
    question: "Who was the first human to walk on the Moon?",
    options: [
      "Yuri Gagarin",
      "Buzz Aldrin",
      "Neil Armstrong",
      "John Glenn"
    ],
    correctIndex: 2
  },

  {
    id: "general-2-11",
    stage: 2,
    question: "What is the chemical symbol for gold?",
    options: [
      "Ag",
      "Gd",
      "Au",
      "Go"
    ],
    correctIndex: 2
  },

  {
    id: "general-2-12",
    stage: 2,
    question: "What elements make up water?",
    options: [
      "Hydrogen and oxygen",
      "Oxygen and carbon",
      "Hydrogen and nitrogen",
      "Carbon and nitrogen"
    ],
    correctIndex: 0
  },

  {
    id: "general-2-13",
    stage: 2,
    question: "What is the largest mammal on Earth?",
    options: [
      "African elephant",
      "Blue whale",
      "Giraffe",
      "Whale shark"
    ],
    correctIndex: 1
  },

  {
    id: "general-2-14",
    stage: 2,
    question: "What is the capital of Russia?",
    options: [
      "Saint Petersburg",
      "Moscow",
      "Kazan",
      "Sochi"
    ],
    correctIndex: 1
  },

  {
    id: "general-2-15",
    stage: 2,
    question: "What is the fastest land animal?",
    options: [
      "Lion",
      "Horse",
      "Cheetah",
      "Leopard"
    ],
    correctIndex: 2
  },


  /* =======================================================
     STAGE 3 — 15 QUESTIONS
  ======================================================= */

  {
    id: "general-3-1",
    stage: 3,
    question: "Which country is commonly described as being shaped like a dragon or seahorse?",
    options: [
      "Vietnam",
      "Thailand",
      "Laos",
      "Cambodia"
    ],
    correctIndex: 0
  },

  {
    id: "general-3-2",
    stage: 3,
    question: "Which sport is played with a ball over a net by teams of six players?",
    options: [
      "Tennis",
      "Volleyball",
      "Basketball",
      "Handball"
    ],
    correctIndex: 1
  },

  {
    id: "general-3-3",
    stage: 3,
    question: "Which instrument usually has six strings?",
    options: [
      "Piano",
      "Flute",
      "Guitar",
      "Trumpet"
    ],
    correctIndex: 2
  },

  {
    id: "general-3-4",
    stage: 3,
    question: "What is the capital of China?",
    options: [
      "Shanghai",
      "Hong Kong",
      "Beijing",
      "Guangzhou"
    ],
    correctIndex: 2
  },

  {
    id: "general-3-5",
    stage: 3,
    question: "Which black-and-white animal is strongly associated with China?",
    options: [
      "Zebra",
      "Panda",
      "Skunk",
      "Penguin"
    ],
    correctIndex: 1
  },

  {
    id: "general-3-6",
    stage: 3,
    question: "What is the capital of Japan?",
    options: [
      "Kyoto",
      "Osaka",
      "Hiroshima",
      "Tokyo"
    ],
    correctIndex: 3
  },

  {
    id: "general-3-7",
    stage: 3,
    question: "Which ocean lies between Africa, Asia, and Australia?",
    options: [
      "Atlantic Ocean",
      "Pacific Ocean",
      "Indian Ocean",
      "Arctic Ocean"
    ],
    correctIndex: 2
  },

  {
    id: "general-3-8",
    stage: 3,
    question: "Which metal is liquid at room temperature?",
    options: [
      "Iron",
      "Mercury",
      "Copper",
      "Aluminium"
    ],
    correctIndex: 1
  },

  {
    id: "general-3-9",
    stage: 3,
    question: "What is the capital of Egypt?",
    options: [
      "Alexandria",
      "Giza",
      "Cairo",
      "Luxor"
    ],
    correctIndex: 2
  },

  {
    id: "general-3-10",
    stage: 3,
    question: "Which country is often described as being shaped like a boot?",
    options: [
      "Greece",
      "Italy",
      "Portugal",
      "Croatia"
    ],
    correctIndex: 1
  },

  {
    id: "general-3-11",
    stage: 3,
    question: "What is the largest land animal?",
    options: [
      "Giraffe",
      "Hippopotamus",
      "African elephant",
      "Rhinoceros"
    ],
    correctIndex: 2
  },

  {
    id: "general-3-12",
    stage: 3,
    question: "How many continents are there?",
    options: [
      "5",
      "6",
      "7",
      "8"
    ],
    correctIndex: 2
  },

  {
    id: "general-3-13",
    stage: 3,
    question: "Which is the hottest planet in the Solar System?",
    options: [
      "Mercury",
      "Venus",
      "Mars",
      "Jupiter"
    ],
    correctIndex: 1
  },

  {
    id: "general-3-14",
    stage: 3,
    question: "What is the capital of Spain?",
    options: [
      "Barcelona",
      "Seville",
      "Valencia",
      "Madrid"
    ],
    correctIndex: 3
  },

  {
    id: "general-3-15",
    stage: 3,
    question: "Who wrote the Harry Potter series?",
    options: [
      "J.K. Rowling",
      "J.R.R. Tolkien",
      "Suzanne Collins",
      "C.S. Lewis"
    ],
    correctIndex: 0
  },


  /* =======================================================
     STAGE 4 — 15 QUESTIONS
  ======================================================= */

  {
    id: "general-4-1",
    stage: 4,
    question: "What is the capital of India?",
    options: [
      "Mumbai",
      "New Delhi",
      "Kolkata",
      "Bengaluru"
    ],
    correctIndex: 1
  },

  {
    id: "general-4-2",
    stage: 4,
    question: "Which country is famous for the Pyramids of Giza?",
    options: [
      "Egypt",
      "Mexico",
      "Peru",
      "Jordan"
    ],
    correctIndex: 0
  },

  {
    id: "general-4-3",
    stage: 4,
    question: "Which continent is south of Europe and north of Antarctica?",
    options: [
      "Asia",
      "Africa",
      "South America",
      "Australia"
    ],
    correctIndex: 1
  },

  {
    id: "general-4-4",
    stage: 4,
    question: "What is the capital of Iraq?",
    options: [
      "Basra",
      "Mosul",
      "Baghdad",
      "Erbil"
    ],
    correctIndex: 2
  },

  {
    id: "general-4-5",
    stage: 4,
    question: "What is the main component of Earth's core?",
    options: [
      "Iron",
      "Gold",
      "Aluminium",
      "Silicon"
    ],
    correctIndex: 0
  },

  {
    id: "general-4-6",
    stage: 4,
    question: "What is the largest hot desert in the world?",
    options: [
      "Gobi",
      "Sahara",
      "Arabian Desert",
      "Kalahari"
    ],
    correctIndex: 1
  },

  {
    id: "general-4-7",
    stage: 4,
    question: "What is the longest river in Africa?",
    options: [
      "Congo",
      "Niger",
      "Nile",
      "Zambezi"
    ],
    correctIndex: 2
  },

  {
    id: "general-4-8",
    stage: 4,
    question: "Who developed the theory of relativity?",
    options: [
      "Isaac Newton",
      "Albert Einstein",
      "Galileo Galilei",
      "Nikola Tesla"
    ],
    correctIndex: 1
  },

  {
    id: "general-4-9",
    stage: 4,
    question: "Who formulated the three laws of motion?",
    options: [
      "Albert Einstein",
      "Isaac Newton",
      "Johannes Kepler",
      "Galileo Galilei"
    ],
    correctIndex: 1
  },

  {
    id: "general-4-10",
    stage: 4,
    question: "What is the capital of Greece?",
    options: [
      "Athens",
      "Thessaloniki",
      "Patras",
      "Heraklion"
    ],
    correctIndex: 0
  },

  {
    id: "general-4-11",
    stage: 4,
    question: "Which country currently has the largest population?",
    options: [
      "China",
      "India",
      "United States",
      "Indonesia"
    ],
    correctIndex: 1
  },

  {
    id: "general-4-12",
    stage: 4,
    question: "Which planet has the fastest rotation?",
    options: [
      "Earth",
      "Jupiter",
      "Saturn",
      "Mars"
    ],
    correctIndex: 1
  },

  {
    id: "general-4-13",
    stage: 4,
    question: "What is the capital of South Korea?",
    options: [
      "Busan",
      "Incheon",
      "Seoul",
      "Daegu"
    ],
    correctIndex: 2
  },

  {
    id: "general-4-14",
    stage: 4,
    question: "What was Istanbul historically known as Constantinople?",
    options: [
      "Its former name",
      "Its ancient river",
      "Its neighboring city",
      "Its former capital of Greece"
    ],
    correctIndex: 0
  },

  {
    id: "general-4-15",
    stage: 4,
    question: "Which planet is known for having an unusual retrograde rotation?",
    options: [
      "Mars",
      "Earth",
      "Uranus",
      "Jupiter"
    ],
    correctIndex: 2
  },


  /* =======================================================
     STAGE 5 — 15 QUESTIONS
  ======================================================= */

  {
    id: "general-5-1",
    stage: 5,
    question: "What is the largest moon in the Solar System?",
    options: [
      "Titan",
      "Ganymede",
      "Europa",
      "Callisto"
    ],
    correctIndex: 1
  },

  {
    id: "general-5-2",
    stage: 5,
    question: "Which country is known as the Land of a Thousand Lakes?",
    options: [
      "Sweden",
      "Finland",
      "Norway",
      "Iceland"
    ],
    correctIndex: 1
  },

  {
    id: "general-5-3",
    stage: 5,
    question: "What is the capital of Switzerland?",
    options: [
      "Zurich",
      "Geneva",
      "Bern",
      "Basel"
    ],
    correctIndex: 2
  },

  {
    id: "general-5-4",
    stage: 5,
    question: "Which scientist is most associated with the theory of evolution by natural selection?",
    options: [
      "Charles Darwin",
      "Gregor Mendel",
      "Louis Pasteur",
      "James Watson"
    ],
    correctIndex: 0
  },

  {
    id: "general-5-5",
    stage: 5,
    question: "Which element has the chemical symbol O?",
    options: [
      "Osmium",
      "Oxygen",
      "Gold",
      "Ozone"
    ],
    correctIndex: 1
  },

  {
    id: "general-5-6",
    stage: 5,
    question: "Which city is often called the 'City of Love'?",
    options: [
      "Rome",
      "Paris",
      "Venice",
      "Vienna"
    ],
    correctIndex: 1
  },

  {
    id: "general-5-7",
    stage: 5,
    question: "Which river flows through London?",
    options: [
      "Seine",
      "Danube",
      "Thames",
      "Rhine"
    ],
    correctIndex: 2
  },

  {
    id: "general-5-8",
    stage: 5,
    question: "On which planet is Olympus Mons, the largest known volcano in the Solar System?",
    options: [
      "Earth",
      "Mars",
      "Venus",
      "Mercury"
    ],
    correctIndex: 1
  },

  {
    id: "general-5-9",
    stage: 5,
    question: "Which atmospheric layer contains most of Earth's weather?",
    options: [
      "Stratosphere",
      "Mesosphere",
      "Troposphere",
      "Thermosphere"
    ],
    correctIndex: 2
  },

  {
    id: "general-5-10",
    stage: 5,
    question: "Which vitamin is especially important for normal blood clotting?",
    options: [
      "Vitamin A",
      "Vitamin C",
      "Vitamin D",
      "Vitamin K"
    ],
    correctIndex: 3
  },

  {
    id: "general-5-11",
    stage: 5,
    question: "What is the world's largest island?",
    options: [
      "Greenland",
      "New Guinea",
      "Borneo",
      "Madagascar"
    ],
    correctIndex: 0
  },

  {
    id: "general-5-12",
    stage: 5,
    question: "What is the deepest known point in the world's oceans?",
    options: [
      "Tonga Trench",
      "Mariana Trench",
      "Java Trench",
      "Puerto Rico Trench"
    ],
    correctIndex: 1
  },

  {
    id: "general-5-13",
    stage: 5,
    question: "What is the capital of Mongolia?",
    options: [
      "Astana",
      "Bishkek",
      "Ulaanbaatar",
      "Tashkent"
    ],
    correctIndex: 2
  },

  {
    id: "general-5-14",
    stage: 5,
    question: "Which civilization is credited with developing cuneiform writing?",
    options: [
      "Romans",
      "Sumerians",
      "Vikings",
      "Aztecs"
    ],
    correctIndex: 1
  },

  {
    id: "general-5-15",
    stage: 5,
    question: "In which country did the ancient Olympic Games originate?",
    options: [
      "Italy",
      "Egypt",
      "Greece",
      "Turkey"
    ],
    correctIndex: 2
  },


  /* =======================================================
     STAGE 6 — 15 QUESTIONS
  ======================================================= */

  {
    id: "general-6-1",
    stage: 6,
    question: "What is the largest fish species?",
    options: [
      "Great white shark",
      "Whale shark",
      "Bluefin tuna",
      "Manta ray"
    ],
    correctIndex: 1
  },

  {
    id: "general-6-2",
    stage: 6,
    question: "Which scientist is strongly associated with the laws of universal gravitation?",
    options: [
      "Isaac Newton",
      "Albert Einstein",
      "Galileo Galilei",
      "Stephen Hawking"
    ],
    correctIndex: 0
  },

  {
    id: "general-6-3",
    stage: 6,
    question: "What is the capital of New Zealand?",
    options: [
      "Auckland",
      "Christchurch",
      "Wellington",
      "Hamilton"
    ],
    correctIndex: 2
  },

  {
    id: "general-6-4",
    stage: 6,
    question: "Which ancient civilization is known for its extensive stone roads and vast empire centered on Rome?",
    options: [
      "Romans",
      "Maya",
      "Persians",
      "Phoenicians"
    ],
    correctIndex: 0
  },

  {
    id: "general-6-5",
    stage: 6,
    question: "What is the scientific name for modern humans?",
    options: [
      "Homo erectus",
      "Homo habilis",
      "Homo sapiens",
      "Australopithecus"
    ],
    correctIndex: 2
  },

  {
    id: "general-6-6",
    stage: 6,
    question: "What substance in red blood cells carries oxygen?",
    options: [
      "Insulin",
      "Hemoglobin",
      "Keratin",
      "Collagen"
    ],
    correctIndex: 1
  },

  {
    id: "general-6-7",
    stage: 6,
    question: "Which continent has no independent countries?",
    options: [
      "Australia",
      "Antarctica",
      "South America",
      "Europe"
    ],
    correctIndex: 1
  },

  {
    id: "general-6-8",
    stage: 6,
    question: "Who discovered penicillin?",
    options: [
      "Alexander Fleming",
      "Louis Pasteur",
      "Marie Curie",
      "Robert Koch"
    ],
    correctIndex: 0
  },

  {
    id: "general-6-9",
    stage: 6,
    question: "What is the capital of Austria?",
    options: [
      "Salzburg",
      "Vienna",
      "Graz",
      "Linz"
    ],
    correctIndex: 1
  },

  {
    id: "general-6-10",
    stage: 6,
    question: "Which country has the largest area in South America?",
    options: [
      "Argentina",
      "Brazil",
      "Peru",
      "Colombia"
    ],
    correctIndex: 1
  },

  {
    id: "general-6-11",
    stage: 6,
    question: "What is the farthest major planet from the Sun?",
    options: [
      "Uranus",
      "Neptune",
      "Saturn",
      "Pluto"
    ],
    correctIndex: 1
  },

  {
    id: "general-6-12",
    stage: 6,
    question: "Which ancient civilization developed in Mesopotamia?",
    options: [
      "Sumerians",
      "Aztecs",
      "Incas",
      "Vikings"
    ],
    correctIndex: 0
  },

  {
    id: "general-6-13",
    stage: 6,
    question: "What is the capital of Norway?",
    options: [
      "Bergen",
      "Trondheim",
      "Oslo",
      "Stavanger"
    ],
    correctIndex: 2
  },

  {
    id: "general-6-14",
    stage: 6,
    question: "Which part of the blood helps fight pathogens?",
    options: [
      "Red blood cells",
      "Platelets",
      "White blood cells",
      "Plasma only"
    ],
    correctIndex: 2
  },

  {
    id: "general-6-15",
    stage: 6,
    question: "Which ocean lies north of Canada, Russia, and Norway?",
    options: [
      "Atlantic Ocean",
      "Arctic Ocean",
      "Indian Ocean",
      "Pacific Ocean"
    ],
    correctIndex: 1
  },


  /* =======================================================
     STAGE 7 — 15 QUESTIONS
  ======================================================= */

  {
    id: "general-7-1",
    stage: 7,
    question: "What is the largest moon of Saturn?",
    options: [
      "Titan",
      "Rhea",
      "Enceladus",
      "Iapetus"
    ],
    correctIndex: 0
  },

  {
    id: "general-7-2",
    stage: 7,
    question: "Which planet has the lowest average density?",
    options: [
      "Jupiter",
      "Saturn",
      "Uranus",
      "Neptune"
    ],
    correctIndex: 1
  },

  {
    id: "general-7-3",
    stage: 7,
    question: "Which civilization built Machu Picchu?",
    options: [
      "Maya",
      "Aztecs",
      "Incas",
      "Romans"
    ],
    correctIndex: 2
  },

  {
    id: "general-7-4",
    stage: 7,
    question: "What is the capital of Iceland?",
    options: [
      "Akureyri",
      "Reykjavik",
      "Kopavogur",
      "Hafnarfjordur"
    ],
    correctIndex: 1
  },

  {
    id: "general-7-5",
    stage: 7,
    question: "What is the nearest star to the Sun?",
    options: [
      "Sirius",
      "Proxima Centauri",
      "Betelgeuse",
      "Polaris"
    ],
    correctIndex: 1
  },

  {
    id: "general-7-6",
    stage: 7,
    question: "Which country is home to Chichen Itza?",
    options: [
      "Mexico",
      "Peru",
      "Guatemala",
      "Brazil"
    ],
    correctIndex: 0
  },

  {
    id: "general-7-7",
    stage: 7,
    question: "Which planet has a very strongly tilted axis?",
    options: [
      "Uranus",
      "Mars",
      "Mercury",
      "Earth"
    ],
    correctIndex: 0
  },

  {
    id: "general-7-8",
    stage: 7,
    question: "What is the largest desert on Earth, including cold deserts?",
    options: [
      "Sahara",
      "Gobi",
      "Antarctica",
      "Arabian Desert"
    ],
    correctIndex: 2
  },

  {
    id: "general-7-9",
    stage: 7,
    question: "What is the capital of Portugal?",
    options: [
      "Porto",
      "Lisbon",
      "Faro",
      "Braga"
    ],
    correctIndex: 1
  },

  {
    id: "general-7-10",
    stage: 7,
    question: "Which ancient civilization developed democracy in Athens?",
    options: [
      "Ancient Greece",
      "Ancient Egypt",
      "Roman Empire",
      "Persian Empire"
    ],
    correctIndex: 0
  },

  {
    id: "general-7-11",
    stage: 7,
    question: "Why do the phases of the Moon occur?",
    options: [
      "The Moon changes shape",
      "Clouds cover parts of the Moon",
      "The relative positions of the Moon, Earth, and Sun change",
      "Earth's shadow always covers the Moon"
    ],
    correctIndex: 2
  },

  {
    id: "general-7-12",
    stage: 7,
    question: "Which planet rotates in the opposite direction to most planets?",
    options: [
      "Venus",
      "Mars",
      "Jupiter",
      "Neptune"
    ],
    correctIndex: 0
  },

  {
    id: "general-7-13",
    stage: 7,
    question: "In which atmospheric layer is the ozone layer mainly found?",
    options: [
      "Troposphere",
      "Stratosphere",
      "Mesosphere",
      "Thermosphere"
    ],
    correctIndex: 1
  },

  {
    id: "general-7-14",
    stage: 7,
    question: "Which country is known for having the most islands?",
    options: [
      "Indonesia",
      "Sweden",
      "Philippines",
      "Japan"
    ],
    correctIndex: 1
  },

  {
    id: "general-7-15",
    stage: 7,
    question: "Which continent has the most countries?",
    options: [
      "Asia",
      "Europe",
      "Africa",
      "South America"
    ],
    correctIndex: 2
  },


  /* =======================================================
     STAGE 8 — 18 QUESTIONS
  ======================================================= */

  {
    id: "general-8-1",
    stage: 8,
    question: "Which planet has the shortest orbital period around the Sun?",
    options: [
      "Mercury",
      "Venus",
      "Earth",
      "Mars"
    ],
    correctIndex: 0
  },

  {
    id: "general-8-2",
    stage: 8,
    question: "Which civilization was associated with the city of Pompeii?",
    options: [
      "Romans",
      "Greeks",
      "Egyptians",
      "Maya"
    ],
    correctIndex: 0
  },

  {
    id: "general-8-3",
    stage: 8,
    question: "Which scientist is famous for research on radioactivity?",
    options: [
      "Marie Curie",
      "Ada Lovelace",
      "Rosalind Franklin",
      "Jane Goodall"
    ],
    correctIndex: 0
  },

  {
    id: "general-8-4",
    stage: 8,
    question: "Which element is especially important for hemoglobin?",
    options: [
      "Calcium",
      "Iron",
      "Sodium",
      "Potassium"
    ],
    correctIndex: 1
  },

  {
    id: "general-8-5",
    stage: 8,
    question: "What generally happens to gravitational attraction as an object moves farther away from a planet?",
    options: [
      "It increases",
      "It stays exactly the same",
      "It decreases",
      "It becomes zero immediately"
    ],
    correctIndex: 2
  },

  {
    id: "general-8-6",
    stage: 8,
    question: "Which country is located in both Europe and Asia?",
    options: [
      "Turkey",
      "Portugal",
      "Morocco",
      "Egypt"
    ],
    correctIndex: 0
  },

  {
    id: "general-8-7",
    stage: 8,
    question: "What imaginary line divides Earth into the Northern and Southern Hemispheres?",
    options: [
      "Prime Meridian",
      "Equator",
      "Tropic of Cancer",
      "International Date Line"
    ],
    correctIndex: 1
  },

  {
    id: "general-8-8",
    stage: 8,
    question: "Why is Venus hotter than Mercury despite Mercury being closer to the Sun?",
    options: [
      "Venus is much larger",
      "Venus has a thick atmosphere and strong greenhouse effect",
      "Mercury receives no sunlight",
      "Venus rotates much faster"
    ],
    correctIndex: 1
  },

  {
    id: "general-8-9",
    stage: 8,
    question: "Which mineral is especially important for maintaining strong bones?",
    options: [
      "Calcium",
      "Iron",
      "Sodium",
      "Chlorine"
    ],
    correctIndex: 0
  },

  {
    id: "general-8-10",
    stage: 8,
    question: "If the Moon suddenly disappeared, which natural phenomenon would be most directly affected?",
    options: [
      "Earthquakes",
      "Tides",
      "Volcanic eruptions",
      "Seasons"
    ],
    correctIndex: 1
  },

  {
    id: "general-8-11",
    stage: 8,
    question: "What is the main cause of Earth's seasons?",
    options: [
      "Earth's changing distance from the Sun",
      "Earth's axial tilt combined with its orbit",
      "The Moon's gravity",
      "Changes in the Sun's size"
    ],
    correctIndex: 1
  },

  {
    id: "general-8-12",
    stage: 8,
    question: "Which planet is most similar to Earth in size?",
    options: [
      "Mars",
      "Venus",
      "Mercury",
      "Neptune"
    ],
    correctIndex: 1
  },

  {
    id: "general-8-13",
    stage: 8,
    question: "Why does water generally boil at a lower temperature at high altitude?",
    options: [
      "Water becomes lighter",
      "Air pressure is lower",
      "The Sun is farther away",
      "Gravity disappears"
    ],
    correctIndex: 1
  },

  {
    id: "general-8-14",
    stage: 8,
    question: "Which planet has the shortest year?",
    options: [
      "Mercury",
      "Venus",
      "Earth",
      "Mars"
    ],
    correctIndex: 0
  },

  {
    id: "general-8-15",
    stage: 8,
    question: "If Earth did not rotate, what would not exist as it does today?",
    options: [
      "The atmosphere",
      "The normal day-and-night cycle",
      "The oceans",
      "The continents"
    ],
    correctIndex: 1
  },

  {
    id: "general-8-16",
    stage: 8,
    question: "Which part of the ear helps the body maintain balance?",
    options: [
      "Outer ear",
      "Middle ear",
      "Inner ear",
      "Eardrum only"
    ],
    correctIndex: 2
  },

  {
    id: "general-8-17",
    stage: 8,
    question: "Why would an object weigh less on the Moon than on Earth?",
    options: [
      "The Moon has no surface",
      "The Moon's gravity is weaker",
      "Objects become smaller on the Moon",
      "The Moon has no atmosphere"
    ],
    correctIndex: 1
  },

  {
    id: "general-8-18",
    stage: 8,
    question: "Which organ absorbs most nutrients into the bloodstream?",
    options: [
      "Stomach",
      "Large intestine",
      "Small intestine",
      "Liver"
    ],
    correctIndex: 2
  }

];


/* =========================================================
   FUN QUESTIONS
   =========================================================
   Reserved for the site's Fun category.
   The supplied question set contains the 123 General
   Knowledge questions above.
========================================================= */

const funQuestions = [];


/* =========================================================
   EXPORTS
========================================================= */

export {
  generalQuestions,
  funQuestions
};

export default {
  generalQuestions,
  funQuestions
};
