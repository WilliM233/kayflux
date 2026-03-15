module.exports = function seedDefault(db) {
  const tx = db.transaction(() => {
    // ============================================================
    // BRANDS (4 rows)
    // ============================================================
    const insertBrand = db.prepare(`
      INSERT OR IGNORE INTO brands (id, name, color, day_of_week, flagship_show, brand_type, notes, gm_name, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const brands = [
      [1, 'SmackDown', '#0066cc', 'Friday', 'SmackDown', 'Main Roster', 'Friday Night SmackDown. Blue brand.', 'Adam Pearce', 1],
      [2, 'NXT', '#e8c000', 'Tuesday', 'NXT', 'NXT', 'WWE NXT. Gold & Black brand.', 'Ava', 1],
      [3, 'Raw', '#c8102e', 'Monday', 'Raw', 'Main Roster', 'Monday Night Raw. Red brand.', 'Nick Aldis', 1],
      [4, 'Cross-Brand', '#7b2d8b', 'Varies', null, 'Cross-Brand', 'Used for PLEs and events featuring all brands.', null, 1],
    ];
    let brandCount = 0;
    for (const b of brands) {
      const r = insertBrand.run(...b);
      if (r.changes) brandCount++;
    }

    // ============================================================
    // SEASON (1 row)
    // ============================================================
    const insertSeason = db.prepare(`
      INSERT OR IGNORE INTO seasons (id, name, is_current) VALUES (?, ?, ?)
    `);
    const seasonResult = insertSeason.run(1, 'Season 1', 1);
    const seasonCount = seasonResult.changes;

    // ============================================================
    // SHOW TEMPLATES (33 rows)
    // ============================================================
    const insertTemplate = db.prepare(`
      INSERT OR IGNORE INTO show_templates (name, day_of_week, multi_day, show_type, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const showTemplates = [
      ['ECW', 'Varies', 0, 'Weekly Show', 'Classic ECW show template'],
      ['Clash in Paris', 'Saturday', 0, 'PLE', 'International PLE'],
      ['Custom PLE', 'Varies', 0, 'Custom', 'Fully custom PLE — name and arena defined by user'],
      ['Raw', 'Monday', 0, 'Weekly Show', null],
      ['Custom Show', 'Varies', 0, 'Custom', 'Fully custom weekly show — name, logo, and arena defined by user'],
      ['Evolution', 'Saturday', 0, 'PLE', "Women's-focused PLE"],
      ['WrestlePalooza', 'Varies', 0, 'PLE', null],
      ['SummerSlam', 'Saturday', 0, 'PLE', null],
      ['Crown Jewel', 'Saturday', 0, 'PLE', 'Saudi Arabia event'],
      ['NXT Heatwave', 'Saturday', 0, 'NXT PLE', null],
      ['Queen of the Ring', 'Saturday', 0, 'PLE', null],
      ['Royal Rumble', 'Saturday', 0, 'PLE', null],
      ['NXT Halloween Havoc', 'Saturday', 0, 'NXT PLE', null],
      ['NXT Deadline', 'Saturday', 0, 'NXT PLE', 'December Iron Survivor event'],
      ['SmackDown', 'Friday', 0, 'Weekly Show', null],
      ["NXT New Year's Evil", 'Saturday', 0, 'NXT PLE', null],
      ['NXT', 'Tuesday', 0, 'Weekly Show', null],
      ['Night of Champions', 'Saturday', 0, 'PLE', null],
      ['NXT Roadblock', 'Saturday', 0, 'NXT PLE', null],
      ['Elimination Chamber', 'Saturday', 0, 'PLE', null],
      ['NXT Vengeance Day', 'Saturday', 0, 'NXT PLE', null],
      ['King of the Ring', 'Saturday', 0, 'PLE', null],
      ['NXT Stand & Deliver', 'Saturday', 0, 'NXT PLE', 'WrestleMania weekend NXT event'],
      ['Money in the Bank', 'Saturday', 0, 'PLE', null],
      ["Saturday Night's Main Event", 'Saturday', 0, 'PLE', null],
      ['NXT Homecoming', 'Saturday', 0, 'NXT PLE', null],
      ['Survivor Series', 'Saturday', 0, 'PLE', null],
      ['NXT Great American Bash', 'Saturday', 0, 'NXT PLE', null],
      ['NXT Battleground', 'Saturday', 0, 'NXT PLE', null],
      ['NXT No Mercy', 'Saturday', 0, 'NXT PLE', null],
      ['WCW Nitro', 'Monday', 0, 'Weekly Show', 'Classic WCW weekly show template'],
      ['WrestleMania', 'Sunday', 1, 'PLE', null],
      ['Backlash', 'Saturday', 0, 'PLE', null],
    ];
    let templateCount = 0;
    for (const t of showTemplates) {
      const r = insertTemplate.run(...t);
      if (r.changes) templateCount++;
    }

    // ============================================================
    // SUPERSTARS (279 non-custom rows)
    // ============================================================
    const insertSuperstar = db.prepare(`
      INSERT OR IGNORE INTO superstars (name, alignment, brand_id, overall_rating, status, division, division_rank, custom_character)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `);
    const superstars = [
      // Unbranded (brand_id: null)
      ['Abyss', null, null, 85, 'Legend', null, 99],
      ['Afa', null, null, 86, 'Legend', null, 99],
      ['Akira Tozawa', null, null, 68, 'Active', null, 99],
      ['Alundra Blayze', null, null, 85, 'Legend', null, 99],
      ['Andre The Giant', null, null, 88, 'Legend', null, 99],
      ['Armando Estrada', null, null, null, 'Legend', null, 99],
      ['Ax', null, null, null, 'Legend', null, 99],
      ['Bam Bam Bigelow', null, null, null, 'Legend', null, 99],
      ['Barron Blade', null, null, null, 'Legend', null, 99],
      ['Batista', null, null, 89, 'Legend', null, 99],
      ['Big E', null, null, 85, 'Legend', null, 99],
      ['Billy Gunn', null, null, 86, 'Legend', null, 99],
      ['Bobby "The Brain" Heenan', null, null, null, 'Legend', null, 99],
      ['Bobby Newton', null, null, 76, 'Legend', null, 99],
      ['Boogeyman', null, null, 74, 'Legend', null, 99],
      ['Booker T', null, null, 85, 'Legend', null, 99],
      ['Bray Wyatt', null, null, 90, 'Legend', null, 99],
      ['Bret Hart', null, null, 93, 'Legend', null, 99],
      ['Brian Pillman', null, null, null, 'Legend', null, 99],
      ['Brie Bella', null, null, null, 'Active', null, 99],
      ['British Bulldog', null, null, 85, 'Legend', null, 99],
      ['Brock Lesnar', null, null, 94, 'Legend', null, 99],
      ['Brother Love', null, null, null, 'Legend', null, 99],
      ['Brutus Creed', null, null, 77, 'Active', null, 99],
      ['Bubba Ray Dudley', null, null, 85, 'Legend', null, 99],
      ['Bull Nakano', null, null, 90, 'Legend', null, 99],
      ['Captain Lou Albano', null, null, null, 'Legend', null, 99],
      ['Chyna', null, null, 88, 'Legend', null, 99],
      ['Crush', null, null, null, 'Legend', null, 99],
      ["D'Lo Brown", null, null, 83, 'Legend', null, 99],
      ['D-Von Dudley', null, null, 84, 'Legend', null, 99],
      ['DDP', null, null, 85, 'Legend', null, 99],
      ['Doink The Clown', null, null, 74, 'Legend', null, 99],
      ['Dusty Rhodes', null, null, 91, 'Legend', null, 99],
      ['Earthquake', null, null, null, 'Legend', null, 99],
      ['Eddie Guerrero', null, null, 90, 'Legend', null, 99],
      ['El Grande Americano', null, null, 85, 'Active', null, 99],
      ['El Hijo del Vikingo', null, null, 86, 'Active', null, 99],
      ['Eric Bischoff', null, null, 58, 'Legend', null, 99],
      ['Erik', null, null, 78, 'Active', null, 99],
      ['Eve Torres', null, null, 85, 'Legend', null, 99],
      ['Faarooq', null, null, 85, 'Legend', null, 99],
      ['Flammer', null, null, 85, 'Active', null, 99],
      ['Goldberg', null, null, 90, 'Legend', null, 99],
      ['Headbanger Mosh', null, null, 76, 'Legend', null, 99],
      ['Headbanger Thrasher', null, null, 76, 'Legend', null, 99],
      ['Hector Flores', null, null, 77, 'Legend', null, 99],
      ['Honky Tonk Man', null, null, 81, 'Legend', null, 99],
      ['Hulk Hogan', null, null, 94, 'Legend', null, 99],
      ['Islander Haku', null, null, 79, 'Legend', null, 99],
      ['Islander Tama', null, null, 79, 'Legend', null, 99],
      ['Ivar', null, null, 79, 'Active', null, 99],
      ['JBL', null, null, 89, 'Legend', null, 99],
      ['JD McDonagh', null, null, 79, 'Active', null, 99],
      ['Jamal', null, null, 82, 'Legend', null, 99],
      ["Je'Von Evans", null, null, 78, 'Active', null, 99],
      ['Jeff Hardy', null, null, null, 'Legend', null, 99],
      ['Jelly Roll', null, null, 80, 'Legend', null, 99],
      ['Jesse Ventura', null, null, 85, 'Legend', null, 99],
      ['Jim "The Anvil" Neidhart', null, null, 80, 'Legend', null, 99],
      ['Jimmy Hart', null, null, null, 'Legend', null, 99],
      ['John Cena', null, null, 97, 'Legend', null, 99],
      ['Julius Creed', null, null, 78, 'Active', null, 99],
      ['Junkyard Dog', null, null, 84, 'Legend', null, 99],
      ['Kane', null, null, 79, 'Legend', null, 99],
      ['Kelly Kelly', null, null, null, 'Legend', null, 99],
      ['Ken Shamrock', null, null, 86, 'Legend', null, 99],
      ['Kevin Nash', null, null, 88, 'Legend', null, 99],
      ['Kurt Angle', null, null, 89, 'Legend', null, 99],
      ['La Parka', null, null, null, 'Active', null, 99],
      ['Lady Shani', null, null, null, 'Active', null, 99],
      ['Lex Luger', null, null, 87, 'Legend', null, 99],
      ['Macho Man Randy Savage', null, null, 89, 'Legend', null, 99],
      ['Mark Henry', null, null, 92, 'Legend', null, 99],
      ['Maryse', null, null, 79, 'Legend', null, 99],
      ['Matt Hardy', null, null, null, 'Legend', null, 99],
      ['Michelle McCool', null, null, 85, 'Legend', null, 99],
      ['Mick Foley', null, null, null, 'Legend', null, 99],
      ['Miss Elizabeth', null, null, null, 'Legend', null, 99],
      ['Molly Holly', null, null, 83, 'Legend', null, 99],
      ['Moreno', null, null, 77, 'Legend', null, 99],
      ['Mr. Fuji', null, null, null, 'Legend', null, 99],
      ['Mr. Iguana', null, null, 81, 'Active', null, 99],
      ['Mr. Perfect', null, null, 84, 'Legend', null, 99],
      ['Mr. Wonderful Paul Orndorff', null, null, 86, 'Legend', null, 99],
      ['New Jack', null, null, 86, 'Legend', null, 99],
      ['Octagon Jr', null, null, null, 'Active', null, 99],
      ['Omos', null, null, 80, 'Legend', null, 99],
      ['Otis', null, null, 75, 'Active', null, 99],
      ['Pagano', null, null, null, 'Active', null, 99],
      ['Pat McAfee', null, null, 80, 'Active', null, 99],
      ['Paul Bearer', null, null, null, 'Legend', null, 99],
      ['Paul Heyman', null, null, null, 'Active', null, 99],
      ['Psycho Clown', null, null, 84, 'Active', null, 99],
      ['Ravishing Rick Rude', null, null, 84, 'Legend', null, 99],
      ['Rick Steiner', null, null, 83, 'Legend', null, 99],
      ['Rikishi', null, null, 81, 'Legend', null, 99],
      ['Road Dogg', null, null, 80, 'Legend', null, 99],
      ['Rob Van Dam', null, null, 90, 'Legend', null, 99],
      ['Rosey', null, null, 80, 'Legend', null, 99],
      ['Rowdy Roddy Piper', null, null, 84, 'Legend', null, 99],
      ['Royce Keys', null, null, null, 'Legend', null, 99],
      ['Sandman', null, null, 86, 'Legend', null, 99],
      ['Scott Hall', null, null, 87, 'Legend', null, 99],
      ['Scott Steiner', null, null, null, 'Active', null, 99],
      ['Sensational Sherri', null, null, 80, 'Legend', null, 99],
      ['Shawn Michaels', null, null, 87, 'Legend', null, 99],
      ['Sika', null, null, 86, 'Legend', null, 99],
      ['Smash', null, null, null, 'Legend', null, 99],
      ['Stacy Keibler', null, null, 75, 'Legend', null, 99],
      ['Stephanie McMahon', null, null, 75, 'Legend', null, 99],
      ['Stone Cold Steve Austin', null, null, 97, 'Legend', null, 99],
      ['Superstar Billy Graham', null, null, 92, 'Legend', null, 99],
      ['Tavish', null, null, 76, 'Legend', null, 99],
      ['Terry Funk', null, null, 87, 'Legend', null, 99],
      ['The Great Khali', null, null, 86, 'Legend', null, 99],
      ['The Great Muta', null, null, 86, 'Legend', null, 99],
      ['The Hurricane', null, null, 75, 'Legend', null, 99],
      ['The Iron Sheik', null, null, 85, 'Legend', null, 99],
      ['The Rock', null, null, 95, 'Legend', null, 99],
      ['Theodore Long', null, null, null, 'Legend', null, 99],
      ['Tito Santana', null, null, 87, 'Legend', null, 99],
      ['Torrie Wilson', null, null, null, 'Legend', null, 99],
      ['Triple H', null, null, 91, 'Legend', null, 99],
      ['Tyler Breeze', null, null, 75, 'Legend', null, 99],
      ['Typhoon', null, null, null, 'Legend', null, 99],
      ['Ultimate Warrior', null, null, 92, 'Legend', null, 99],
      ['Umaga', null, null, 86, 'Legend', null, 99],
      ['Undertaker', null, null, 96, 'Legend', null, 99],
      ['Vader', null, null, 87, 'Legend', null, 99],
      ['Victoria', null, null, 89, 'Legend', null, 99],
      ['Wade Barrett', null, null, 85, 'Legend', null, 99],
      ['William Regal', null, null, 76, 'Legend', null, 99],
      ['X-Pac', null, null, 78, 'Legend', null, 99],
      ['Xavier Woods', null, null, 82, 'Active', null, 99],
      ['Yokozuna', null, null, 87, 'Legend', null, 99],

      // SmackDown (brand_id: 1)
      // Non-Competitors
      ['Adam Pearce', null, 1, null, 'Non-Competitor', null, 99],
      ['B-Fab', null, 1, 67, 'Non-Competitor', null, 99],
      ['Cathy Kelley', null, 1, null, 'Non-Competitor', null, 99],
      ['Matt Cardona', null, 1, null, 'Non-Competitor', null, 99],
      // Men's Midcard
      ['Aleister Black', 'Heel', 1, 84, 'Active', "Men's Midcard", 6],
      ['Apollo Crews', 'Face', 1, 70, 'Active', "Men's Midcard", 11],
      ['Erick Rowan', 'Heel', 1, 80, 'Active', "Men's Midcard", 8],
      ['JC Mateo', 'Heel', 1, 82, 'Active', "Men's Midcard", 7],
      ['Jimmy Uso', 'Heel', 1, 86, 'Active', "Men's Midcard", 3],
      ['Sami Zayn', 'Face', 1, 89, 'Active', "Men's Midcard", 1],
      ['Sheamus', 'Face', 1, 86, 'Active', "Men's Midcard", 4],
      ['Shinsuke Nakamura', 'Face', 1, 86, 'Active', "Men's Midcard", 5],
      ['Talla Tonga', 'Heel', 1, 77, 'Active', "Men's Midcard", 10],
      ['The Miz', 'Heel', 1, 80, 'Active', "Men's Midcard", 9],
      ['Uncle Howdy', 'Heel', 1, 87, 'Active', "Men's Midcard", 2],
      // Men's Tag
      ['Alex Shelley', 'Face', 1, 80, 'Active', "Men's Tag", 3],
      ['Angel', 'Heel', 1, 72, 'Active', "Men's Tag", 7],
      ['Angelo Dawkins', 'Face', 1, 78, 'Active', "Men's Tag", 4],
      ['Berto', 'Heel', 1, 72, 'Active', "Men's Tag", 7],
      ['Chris Sabin', 'Face', 1, 80, 'Active', "Men's Tag", 3],
      ['Dexter Lumis', 'Heel', 1, 82, 'Active', "Men's Tag", 2],
      ['Joe Gacy', 'Heel', 1, 82, 'Active', "Men's Tag", 2],
      ['Johnny Gargano', 'Face', 1, 76, 'Active', "Men's Tag", 6],
      ['Ludwig Kaiser', 'Heel', 1, 77, 'Active', "Men's Tag", 5],
      ['Montez Ford', 'Face', 1, 80, 'Active', "Men's Tag", 4],
      ['Rusev', 'Heel', 1, 83, 'Active', "Men's Tag", 5],
      ['Tama Tonga', 'Heel', 1, 83, 'Active', "Men's Tag", 1],
      ['Tommaso Ciampa', 'Face', 1, 77, 'Active', "Men's Tag", 6],
      ['Tonga Loa', 'Heel', 1, 79, 'Active', "Men's Tag", 1],
      // Men's World
      ['AJ Styles', 'Face', 1, 88, 'Active', "Men's World", 8],
      ['Damian Priest', 'Heel', 1, 87, 'Active', "Men's World", 6],
      ['Drew McIntyre', 'Face', 1, 93, 'Active', "Men's World", 2],
      ['Jacob Fatu', 'Heel', 1, 88, 'Active', "Men's World", 5],
      ['Kevin Owens', 'Face', 1, 87, 'Active', "Men's World", 7],
      ['LA Knight', 'Face', 1, 89, 'Active', "Men's World", 3],
      ['Penta', 'Heel', 1, 84, 'Active', "Men's World", 8],
      ['Roman Reigns', 'Heel', 1, 95, 'Active', "Men's World", 1],
      // Women's Midcard
      ['Alexa Bliss', 'Face', 1, 87, 'Active', "Women's Midcard", 1],
      ['Ivy Nile', 'Heel', 1, 76, 'Active', "Women's Midcard", 5],
      ['Jordynne Grace', 'Face', 1, 81, 'Active', "Women's Midcard", 4],
      ['Kiana James', 'Heel', 1, 73, 'Active', "Women's Midcard", 6],
      ['Lita', 'Face', 1, 87, 'Active', "Women's Midcard", 2],
      ['Nikki Cross', 'Heel', 1, 73, 'Active', "Women's Midcard", 7],
      ['Zelina', 'Heel', 1, 83, 'Active', "Women's Midcard", 3],
      // Women's Tag
      ['Alba Fyre', 'Heel', 1, 77, 'Active', "Women's Tag", 3],
      ['Chelsea Green', 'Heel', 1, 85, 'Active', "Women's Tag", 3],
      ['Giulia', 'Heel', 1, 86, 'Active', "Women's Tag", 1],
      ['Naomi', 'Face', 1, 92, 'Active', "Women's Tag", 1],
      ['Trish Stratus', 'Face', 1, 89, 'Active', "Women's Tag", 1],
      ['Zoey Stark', 'Face', 1, 80, 'Active', "Women's Tag", 1],
      // Women's World
      ['AJ Lee', 'Heel', 1, 87, 'Active', "Women's World", 7],
      ['Bayley', 'Face', 1, 89, 'Active', "Women's World", 4],
      ['Bianca Belair', 'Face', 1, 94, 'Active', "Women's World", 2],
      ['IYO SKY', 'Heel', 1, 93, 'Active', "Women's World", 3],
      ['Jade Cargill', 'Face', 1, 88, 'Active', "Women's World", 5],
      ['Nia Jax', 'Heel', 1, 88, 'Active', "Women's World", 7],
      ['Rhea Ripley', 'Heel', 1, 96, 'Active', "Women's World", 1],

      // NXT (brand_id: 2)
      ['Ava', null, 2, null, 'Active', null, 99],
      // Men's Midcard
      ['Charlie Dempsey', null, 2, 75, 'Active', "Men's Midcard", 6],
      ['Lexis King', null, 2, 74, 'Active', "Men's Midcard", 4],
      ['Myles Borne', null, 2, 75, 'Active', "Men's Midcard", 7],
      ['Noam Dar', null, 2, 76, 'Active', "Men's Midcard", 3],
      ['Shawn Spears', null, 2, 75, 'Active', "Men's Midcard", 2],
      ['Tavion Heights', null, 2, 76, 'Active', "Men's Midcard", 5],
      ["Tony D'Angelo", null, 2, 79, 'Active', "Men's Midcard", 1],
      // Men's Tag
      ['Andre Chase', null, 2, 73, 'Active', "Men's Tag", 6],
      ['Brooks Jensen', null, 2, 73, 'Active', "Men's Tag", 4],
      ['Channing "Stacks" Lorenzo', null, 2, 74, 'Active', "Men's Tag", 1],
      ['Hank Walker', null, 2, 77, 'Active', "Men's Tag", 5],
      ['Josh Briggs', null, 2, 74, 'Active', "Men's Tag", 3],
      ['Ridge Holland', null, 2, 74, 'Active', "Men's Tag", 8],
      ['Tank Ledger', null, 2, 77, 'Active', "Men's Tag", 2],
      ['Yoshiki Inamura', null, 2, 75, 'Active', "Men's Tag", 7],
      // Men's World
      ['Carmelo Hayes', 'Heel', 2, 84, 'Active', "Men's World", 1],
      ['Ethan Page', null, 2, 83, 'Active', "Men's World", 6],
      ['Joe Hendry', null, 2, 80, 'Active', "Men's World", 4],
      ['Oba Femi', null, 2, 85, 'Active', "Men's World", 2],
      ['Ricky Saints', null, 2, 81, 'Active', "Men's World", 5],
      // Women's Midcard
      ['Blake Monroe', null, 2, 78, 'Active', "Women's Midcard", 5],
      ['Fallon Henley', null, 2, 78, 'Active', "Women's Midcard", 1],
      ['Jazmyn Nyx', null, 2, 72, 'Active', "Women's Midcard", 3],
      ['Wendy Choo', null, 2, 72, 'Active', "Women's Midcard", 4],
      ['Wren Sinclair', null, 2, 74, 'Active', "Women's Midcard", 2],
      // Women's Tag
      ['Izzi Dame', null, 2, 76, 'Active', "Women's Tag", 2],
      ['Nikkita Lyons', null, 2, 73, 'Active', "Women's Tag", 1],
      ['Thea Hail', null, 2, 75, 'Active', "Women's Tag", 3],
      // Women's World
      ['Jaida Parker', null, 2, 77, 'Active', "Women's World", 1],
      ['Karmen Petrovic', null, 2, 75, 'Active', "Women's World", 4],
      ['Sol Ruca', null, 2, 77, 'Active', "Women's World", 2],
      ['Tatum Paxley', null, 2, 75, 'Active', "Women's World", 3],
      ['Zaria', null, 2, 75, 'Active', "Women's World", 5],

      // Raw (brand_id: 3)
      // Non-Competitor
      ['Nick Aldis', null, 3, null, 'Non-Competitor', null, 99],
      // Men's Midcard
      ['Austin Theory', 'Heel', 3, 82, 'Active', "Men's Midcard", 9],
      ['Bronson Reed', 'Heel', 3, 88, 'Active', "Men's Midcard", 6],
      ['Chad Gable', 'Heel', 3, 81, 'Active', "Men's Midcard", 10],
      ['Dominik Mysterio', 'Heel', 3, 87, 'Active', "Men's Midcard", 1],
      ['Finn Balor', 'Heel', 3, 88, 'Active', "Men's Midcard", 5],
      ['Grayson Waller', 'Heel', 3, 73, 'Active', "Men's Midcard", 12],
      ['Ilja Dragunov', 'Face', 3, 85, 'Active', "Men's Midcard", 3],
      ['Kofi Kingston', null, 3, 83, 'Active', "Men's Midcard", 13],
      ['R-Truth', 'Face', 3, 80, 'Active', "Men's Midcard", 11],
      ['Rey Mysterio', 'Face', 3, 85, 'Active', "Men's Midcard", 7],
      ['Santos Escobar', 'Tweener', 3, 76, 'Active', "Men's Midcard", 4],
      ['Solo Sikoa', 'Heel', 3, 85, 'Active', "Men's Midcard", 2],
      ['Trick Williams', 'Face', 3, 84, 'Active', "Men's Midcard", 8],
      // Men's Tag
      ['Axiom', 'Face', 3, 75, 'Active', "Men's Tag", 1],
      ['Cruz Del Toro', 'Face', 3, 73, 'Active', "Men's Tag", 5],
      ['Dragon Lee', 'Face', 3, 79, 'Active', "Men's Tag", 3],
      ['Elton Prince', 'Face', 3, 71, 'Active', "Men's Tag", 4],
      ['Joaquin Wilde', 'Face', 3, 72, 'Active', "Men's Tag", 5],
      ['Kit Wilson', 'Face', 3, 74, 'Active', "Men's Tag", 4],
      ['Nathan Frazer', 'Face', 3, 76, 'Active', "Men's Tag", 1],
      ['Pete Dunne', 'Tweener', 3, 76, 'Active', "Men's Tag", 2],
      ['Rey Fenix', 'Face', 3, 78, 'Active', "Men's Tag", 3],
      ['Tyler Bate', 'Face', 3, 76, 'Active', "Men's Tag", 2],
      // Men's World
      ['Bron Breakker', 'Heel', 3, 90, 'Active', "Men's World", 8],
      ['CM Punk', 'Face', 3, 94, 'Active', "Men's World", 3],
      ['Cody Rhodes', 'Face', 3, 95, 'Active', "Men's World", 1],
      ['Gunther', 'Heel', 3, 93, 'Active', "Men's World", 4],
      ['Jey Uso', 'Face', 3, 91, 'Active', "Men's World", 6],
      ['Logan Paul', 'Heel', 3, 90, 'Active', "Men's World", 7],
      ['Randy Orton', 'Face', 3, 92, 'Active', "Men's World", 5],
      ['Seth Rollins', 'Heel', 3, 94, 'Active', "Men's World", 2],
      // Women's Midcard
      ['Candice LeRae', 'Face', 3, 73, 'Active', "Women's Midcard", 5],
      ['Jacy Jayne', 'Heel', 3, 80, 'Active', "Women's Midcard", 6],
      ['Kelani Jordan', 'Face', 3, 79, 'Active', "Women's Midcard", 7],
      ['Lash Legend', 'Heel', 3, 81, 'Active', "Women's Midcard", 2],
      ['Lola Vice', 'Tweener', 3, 78, 'Active', "Women's Midcard", 8],
      ['Maxxine Dupri', 'Face', 3, 78, 'Active', "Women's Midcard", 4],
      ['Michin', 'Face', 3, 82, 'Active', "Women's Midcard", 1],
      ['Piper Niven', 'Heel', 3, 79, 'Active', "Women's Midcard", 3],
      // Women's Tag
      ['Asuka', 'Face', 3, 91, 'Active', "Women's Tag", 1],
      ['Kairi Sane', 'Face', 3, 84, 'Active', "Women's Tag", 1],
      ['Raquel Rodriguez', 'Heel', 3, 86, 'Active', "Women's Tag", 2],
      ['Roxanne Perez', 'Heel', 3, 85, 'Active', "Women's Tag", 2],
      // Women's World
      ['Becky Lynch', 'Face', 3, 94, 'Active', "Women's World", 1],
      ['Charlotte Flair', 'Heel', 3, 93, 'Active', "Women's World", 2],
      ['Liv Morgan', 'Heel', 3, 92, 'Active', "Women's World", 6],
      ['Lyra Valkyria', 'Face', 3, 84, 'Active', "Women's World", 5],
      ['Natalya', 'Face', 3, 86, 'Active', "Women's World", 8],
      ['Nikki Bella', 'Heel', 3, 88, 'Active', "Women's World", 7],
      ['Stephanie Vaquer', 'Face', 3, 92, 'Active', "Women's World", 4],
      ['Tiffany Stratton', 'Heel', 3, 91, 'Active', "Women's World", 3],
    ];
    let superstarCount = 0;
    for (const s of superstars) {
      const r = insertSuperstar.run(...s);
      if (r.changes) superstarCount++;
    }

    // ============================================================
    // CHAMPIONSHIPS (43 rows)
    // ============================================================
    const insertChampionship = db.prepare(`
      INSERT OR IGNORE INTO championships (name, brand_id, active, category, division, is_vacant, lineage_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const championships = [
      ['AAA Mega Championship', null, 0, 'AAA', "Men's Singles", 1, "Top men's title in Lucha Libre AAA promotion. New addition in WWE 2K26 via Ringside Pass."],
      ['AAA Reina De Reinas Championship', null, 0, 'AAA', "Women's Singles", 1, "Top women's title in Lucha Libre AAA promotion. New addition in WWE 2K26 via Ringside Pass."],
      ['Brahma Bull WWE Championship', null, 0, 'Classic WWE', "Men's Singles", 1, 'Custom design of the WWE Championship created for The Rock. Variant of the WWE Championship lineage.'],
      ['Crown Jewel Championship', null, 0, 'Current WWE', "Men's Singles", 1, 'Exclusive to Saudi Arabia events. New in WWE 2K26.'],
      ['ECW Championship', null, 0, 'ECW & WCW', "Men's Singles", 1, "Includes original ECW World Championship ('94-'01) and WWE's ECW revival versions ('06-'08, '08-'10). All collapsed into one lineage."],
      ['ECW World Tag Team Championship', null, 0, 'ECW & WCW', 'Tag Team', 1, 'Tag titles of original ECW promotion.'],
      ['ECW World Television Championship', null, 0, 'ECW & WCW', "Men's Singles", 1, "Secondary title in original ECW. Active through most of ECW's run in the 1990s."],
      ['Million Dollar Championship', null, 0, 'Classic WWE', "Men's Singles", 1, "Created by Ted DiBiase Sr. in 1989. Never an officially sanctioned WWE title — personal vanity belt."],
      ['NXT Championship', 2, 1, 'Current WWE', "Men's Singles", 1, "NXT's top title. Includes designs from '12-'17, '17-'21, '22-'24, and current. All collapsed into one lineage."],
      ['NXT Cruiserweight Championship', null, 0, 'Current WWE', "Men's Singles", 1, 'NXT cruiserweight division title.'],
      ['NXT North American Championship', 2, 1, 'Current WWE', "Men's Singles", 1, "Introduced in 2018. Secondary men's title on NXT."],
      ['NXT Tag Team Championship', 2, 1, 'Current WWE', 'Tag Team', 1, "NXT tag title. Includes '13-'17 design and current design."],
      ['NXT UK Championship', null, 0, 'Classic WWE', "Men's Singles", 1, 'Top title of NXT UK brand (2018-2022). Brand discontinued; title retired.'],
      ['NXT UK Tag Team Championship', null, 0, 'Classic WWE', 'Tag Team', 1, 'Tag titles of NXT UK brand (2019-2022). Retired when NXT UK folded.'],
      ["NXT UK Women's Championship", null, 0, 'Classic WWE', "Women's Singles", 1, "Women's title of NXT UK brand (2018-2022). Retired when NXT UK folded."],
      ["NXT Women's Championship", 2, 1, 'Current WWE', "Women's Singles", 1, "NXT's top women's title. Includes designs from '13-'17, '17-'21, '22-'24, and current."],
      ["NXT Women's North American Championship", 2, 1, 'Current WWE', "Women's Singles", 1, "Introduced in 2023 as women's secondary title on NXT."],
      ["NXT Women's Tag Team Championship", 2, 0, 'Current WWE', 'Tag Team', 1, 'Introduced in 2021.'],
      ['Smoking Skull WWE Championship', null, 0, 'Classic WWE', "Men's Singles", 1, 'Custom design of the WWE Championship created for Stone Cold Steve Austin. Variant of the WWE Championship lineage.'],
      ['The Fiend Universal Championship', null, 0, 'Classic WWE', "Men's Singles", 1, 'Custom horror-themed design of the Universal Championship held by Bray Wyatt in 2019-2020.'],
      ['WCW Cruiserweight Championship', null, 0, 'ECW & WCW', "Men's Singles", 1, "WCW's cruiserweight division title. Brought to WWE briefly after WCW merger."],
      ['WCW Hardcore Championship', null, 0, 'ECW & WCW', "Men's Singles", 1, "WCW's hardcore title, introduced late in the promotion's run."],
      ['WCW Tag Team Championship', null, 0, 'ECW & WCW', 'Tag Team', 1, "Includes '91-'96 and main WCW World Tag Team Championship designs."],
      ['WCW United States Championship', null, 0, 'ECW & WCW', "Men's Singles", 1, "Secondary WCW title, later absorbed into WWE's US title lineage after WCW merger."],
      ["WCW Women's Championship", null, 0, 'ECW & WCW', "Women's Singles", 1, "WCW's women's title. Largely inactive during most of WCW's run."],
      ['WCW World Championship', null, 0, 'ECW & WCW', "Men's Singles", 1, "Includes WCW World Championship '91-'93, nWo World Championship, and nWo Legacy variants. Top title of WCW until 2001."],
      ["Women's Intercontinental Championship", 3, 1, 'Current WWE', "Women's Singles", 1, 'New title introduced in 2024. No prior lineage.'],
      ["Women's Tag Team Championship", null, 1, 'Current WWE', 'Tag Team', 1, "Introduced in 2019 as the first women's tag title in WWE history. Cross-brand."],
      ["Women's United States Championship", 1, 1, 'Current WWE', "Women's Singles", 1, 'New title introduced in 2024. No prior lineage.'],
      ["Women's World Championship", 3, 1, 'Current WWE', "Women's Singles", 1, "SmackDown women's lineage. Includes SmackDown Women's Championship. Rebranded to Women's World Championship in 2023."],
      ['World Heavyweight Championship', 3, 1, 'Current WWE', "Men's Singles", 1, "Reactivated in 2023 as separate title from WWE Championship. Lineage traces back to World Heavyweight Championship '02-'13 (originally WCW-derived)."],
      ['World Tag Team Championship', 3, 1, 'Current WWE', 'Tag Team', 1, "Raw-brand tag lineage. Traces back to the original WWF Tag Team titles. Includes Raw Tag Team Championship and World Tag Team Championship variants."],
      ['WWE 24/7 Championship', null, 0, 'Classic WWE', "Men's Singles", 1, 'Active 2019-2023. Successor to the Hardcore Championship with 24/7 rules. Retired and replaced by Speed Championship.'],
      ['WWE Championship', 1, 1, 'Current WWE', "Men's Singles", 1, 'Lineage traces back to WWWF Heavyweight Championship (1963). Unified WWE Championship and Universal Championship in 2023. Current design introduced 2023.'],
      ['WWE Cruiserweight Championship', null, 0, 'Classic WWE', "Men's Singles", 1, 'Active 2001-2007 on SmackDown. Originated in WCW.'],
      ['WWE European Championship', null, 0, 'Classic WWE', "Men's Singles", 1, 'Active 1997-2002. Unified with Intercontinental title by Triple H.'],
      ['WWE Hardcore Championship', null, 0, 'Classic WWE', "Men's Singles", 1, 'Active 1998-2002. Famous for 24/7 rule. Retired by Triple H.'],
      ['WWE Intercontinental Championship', 3, 1, 'Current WWE', "Men's Singles", 1, "One of WWE's oldest titles, introduced 1979. Various belt designs over the decades — all collapsed into this lineage."],
      ['WWE Light Heavyweight Championship', null, 0, 'Classic WWE', "Men's Singles", 1, 'Active 1997-2001. Predecessor to the Cruiserweight division in WWE.'],
      ['WWE Tag Team Championship', 1, 1, 'Current WWE', 'Tag Team', 1, "SmackDown-brand tag lineage. Includes SmackDown Tag Team Championship and WWE Tag Team Championship variants ('02-'10, '10-'16)."],
      ['WWE United Kingdom Championship', null, 0, 'Classic WWE', "Men's Singles", 1, 'Separate from NXT UK Championship. Introduced 2017, defended on NXT UK and UK tours.'],
      ['WWE United States Championship', 1, 1, 'Current WWE', "Men's Singles", 1, "Originated in WCW (1975). Brought to WWE in 2001. Spinner variant (John Cena design) and '03-'20 design all part of this lineage."],
      ["WWE Women's Championship", 1, 1, 'Current WWE', "Women's Singles", 1, "Raw women's lineage. Includes WWE Women's Championship '98-'10, Divas Championship, and Raw Women's Championship. Current design introduced 2023."],
    ];
    let champCount = 0;
    for (const c of championships) {
      const r = insertChampionship.run(...c);
      if (r.changes) champCount++;
    }

    // ============================================================
    // CHAMPIONSHIP BRANDS (junction table, 19 rows)
    // ============================================================
    const getChampId = db.prepare('SELECT id FROM championships WHERE name = ?');
    const insertChampBrand = db.prepare(`
      INSERT OR IGNORE INTO championship_brands (championship_id, brand_id)
      VALUES (?, ?)
    `);
    const champBrands = [
      ['NXT Championship', 2],
      ['NXT North American Championship', 2],
      ['NXT Tag Team Championship', 2],
      ["NXT Women's Championship", 2],
      ["NXT Women's North American Championship", 2],
      ["NXT Women's Tag Team Championship", 2],
      ["Women's Intercontinental Championship", 3],
      ["Women's Tag Team Championship", 1],
      ["Women's Tag Team Championship", 2],
      ["Women's Tag Team Championship", 3],
      ["Women's United States Championship", 1],
      ["Women's World Championship", 3],
      ['World Heavyweight Championship', 3],
      ['World Tag Team Championship', 3],
      ['WWE Championship', 1],
      ['WWE Intercontinental Championship', 3],
      ['WWE Tag Team Championship', 1],
      ['WWE United States Championship', 1],
      ["WWE Women's Championship", 1],
    ];
    let champBrandCount = 0;
    for (const [champName, brandId] of champBrands) {
      const row = getChampId.get(champName);
      if (row) {
        const r = insertChampBrand.run(row.id, brandId);
        if (r.changes) champBrandCount++;
      }
    }

    // ============================================================
    // GUIDES (5 rows)
    // ============================================================
    const insertGuide = db.prepare(`
      INSERT OR IGNORE INTO guides (slug, title, category, brand_id, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    const guides = [
      ['cowork-protocol', 'Cowork Protocol', 'protocol', null, 1],
      ['cco-hq-guide', 'CCO HQ Guide', 'cco', null, 2],
      ['raw-gm-guide', 'Raw GM Guide — Nick Aldis', 'gm-guide', 3, 1],
      ['smackdown-gm-guide', 'SmackDown GM Guide — Adam Pearce', 'gm-guide', 1, 2],
      ['nxt-gm-guide', 'NXT GM Guide — Ava', 'gm-guide', 2, 3],
    ];
    let guideCount = 0;
    for (const g of guides) {
      const r = insertGuide.run(...g);
      if (r.changes) guideCount++;
    }

    console.log(`Default seed: ${brandCount} brands, ${superstarCount} superstars, ${champCount} championships, ${champBrandCount} championship-brand links, ${templateCount} show templates, ${seasonCount} seasons, ${guideCount} guides`);
  });

  tx();
};
