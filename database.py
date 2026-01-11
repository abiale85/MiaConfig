"""Database manager per Dynamic Config."""
import sqlite3
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

_LOGGER = logging.getLogger(__name__)


class ConfigDatabase:
    """Gestisce il database SQLite per le configurazioni dinamiche."""
    
    def __init__(self, db_path: str):
        """Inizializza il database manager."""
        self.db_path = db_path
        self.conn = None
        # Cache per descrizioni (raramente cambiano, evita query ripetute)
        self._descriptions_cache = None
        self._cache_timestamp = None
        # Cache per get_next_changes: evita ricalcoli se il valore corrente e le configurazioni non cambiano
        # Struttura: {(setup_name, limit_hours, max_results): {'value': str, 'config_version': int, 'result': list, 'timestamp': str}}
        self._next_changes_cache = {}
        self._config_version = 0  # Incrementato ad ogni modifica di configurazione
        
        # CACHE IN-MEMORY per tutte le configurazioni (caricata all'avvio, aggiornata solo su modifiche)
        # Questo elimina ~40 query al minuto, caricando tutto UNA VOLTA e lavorando in memoria
        self._memory_cache = {
            'configurazioni': [],  # Lista di dict con tutte le config standard
            'configurazioni_a_orario': [],  # Lista di dict con tutte le config a orario
            'configurazioni_a_tempo': [],  # Lista di dict con tutte le config a tempo
            'configurazioni_condizionali': [],  # Lista di dict con tutte le config condizionali
            'descrizioni': {},  # Dict {setup_name: description}
            'loaded': False  # Flag per sapere se la cache è stata caricata
        }
    
    @staticmethod
    def validate_setup_name(setup_name: str) -> str:
        """Valida e sanitizza il nome della configurazione.
        
        Permette solo caratteri alfanumerici e underscore.
        Solleva ValueError se il nome contiene caratteri non validi.
        """
        import re
        if not setup_name:
            raise ValueError("Il nome della configurazione non può essere vuoto")
        
        # Verifica che contenga solo caratteri validi: lettere, numeri, underscore
        if not re.match(r'^[a-zA-Z0-9_]+$', setup_name):
            raise ValueError(
                f"Il nome '{setup_name}' contiene caratteri non validi. "
                "Usa solo lettere, numeri e underscore (es: temperatura_target, setup_1)"
            )
        
        return setup_name
    
    def _open_database(self):
        """Apre la connessione al database."""
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _load_all_to_memory(self) -> None:
        """Carica TUTTE le configurazioni in memoria in un'unica operazione batch.
        
        Questo elimina la necessità di fare query ripetute ogni scan_interval.
        Con pochi setup (7) e pochi override (20), tutto può stare in RAM.
        La cache viene invalidata e ricaricata solo quando ci sono modifiche.
        """
        cursor = self.conn.cursor()
        
        # Carica configurazioni standard (abilitate e non)
        cursor.execute("SELECT * FROM configurazioni ORDER BY priority")
        self._memory_cache['configurazioni'] = [dict(row) for row in cursor.fetchall()]
        
        # Carica configurazioni a orario
        cursor.execute("SELECT * FROM configurazioni_a_orario ORDER BY priority")
        self._memory_cache['configurazioni_a_orario'] = [dict(row) for row in cursor.fetchall()]
        
        # Carica configurazioni a tempo
        cursor.execute("SELECT * FROM configurazioni_a_tempo ORDER BY priority")
        self._memory_cache['configurazioni_a_tempo'] = [dict(row) for row in cursor.fetchall()]
        
        # Carica configurazioni condizionali
        cursor.execute("SELECT * FROM configurazioni_condizionali ORDER BY priority")
        self._memory_cache['configurazioni_condizionali'] = [dict(row) for row in cursor.fetchall()]
        
        # Carica descrizioni
        cursor.execute("SELECT setup_name, description FROM configurazioni_descrizioni")
        self._memory_cache['descrizioni'] = {row['setup_name']: row['description'] for row in cursor.fetchall()}
        
        self._memory_cache['loaded'] = True
        
        _LOGGER.debug(
            f"Cache in-memory caricata: {len(self._memory_cache['configurazioni'])} standard, "
            f"{len(self._memory_cache['configurazioni_a_orario'])} orario, "
            f"{len(self._memory_cache['configurazioni_a_tempo'])} tempo, "
            f"{len(self._memory_cache['configurazioni_condizionali'])} condizionali"
        )
    
    def initialize(self) -> None:
        """Crea le tabelle se non esistono e applica migrazioni."""
        self.conn = self._open_database()
        
        cursor = self.conn.cursor()
        
        # Tabella configurazioni standard
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS configurazioni (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setup_name TEXT NOT NULL,
                setup_value TEXT,
                priority INTEGER NOT NULL DEFAULT 99,
                enabled INTEGER NOT NULL DEFAULT 1
            )
        """)
        
        # Tabella configurazioni a orario
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS configurazioni_a_orario (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setup_name TEXT NOT NULL,
                setup_value TEXT,
                valid_from_ora REAL NOT NULL,
                valid_to_ora REAL,
                days_of_week TEXT DEFAULT '0,1,2,3,4,5,6',
                priority INTEGER NOT NULL DEFAULT 99,
                enabled INTEGER NOT NULL DEFAULT 1
            )
        """)
        
        # Tabella configurazioni a tempo
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS configurazioni_a_tempo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setup_name TEXT NOT NULL,
                setup_value TEXT,
                valid_from_date DATETIME NOT NULL,
                valid_to_date DATETIME,
                valid_from_ora REAL,
                valid_to_ora REAL,
                days_of_week TEXT,
                priority INTEGER NOT NULL DEFAULT 99,
                enabled INTEGER NOT NULL DEFAULT 1
            )
        """)
        
        # Tabella configurazioni condizionali
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS configurazioni_condizionali (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setup_name TEXT NOT NULL,
                setup_value TEXT,
                conditional_config TEXT NOT NULL,
                conditional_operator TEXT NOT NULL,
                conditional_value TEXT NOT NULL,
                valid_from_ora REAL,
                valid_to_ora REAL,
                priority INTEGER NOT NULL DEFAULT 99,
                enabled INTEGER NOT NULL DEFAULT 1
            )
        """)
        
        # Tabella storico configurazioni
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS configurazioni_storico (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setup_name TEXT NOT NULL,
                config_type TEXT NOT NULL,
                setup_value TEXT,
                priority INTEGER,
                valid_from_ora REAL,
                valid_to_ora REAL,
                days_of_week TEXT,
                valid_from_date TEXT,
                valid_to_date TEXT,
                operation TEXT NOT NULL,
                timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Tabella descrizioni (separata, non tocca le altre tabelle)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS configurazioni_descrizioni (
                setup_name TEXT PRIMARY KEY NOT NULL,
                description TEXT
            )
        """)
        
        # Tabella valori validi per ogni configurazione
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS configurazioni_valori_validi (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setup_name TEXT NOT NULL,
                value TEXT NOT NULL,
                description TEXT,
                sort_order INTEGER DEFAULT 0,
                UNIQUE(setup_name, value)
            )
        """)
        
        # Crea indici per ottimizzare le query in _get_configurations_at_time
        # Questi indici velocizzano le query eseguite ad ogni scan_interval
        
        # Indice per configurazioni (lookup per setup_name)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_configurazioni_setup_name 
            ON configurazioni(setup_name, priority)
        """)
        
        # Indice per configurazioni a orario (filtro su orario e giorno)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_orario_ora 
            ON configurazioni_a_orario(valid_from_ora, valid_to_ora)
        """)
        
        # Indice per configurazioni a tempo (filtro su date)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_tempo_date 
            ON configurazioni_a_tempo(valid_from_date, valid_to_date)
        """)
        
        # Indice per configurazioni condizionali (lookup per conditional_config)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_condizionali_config 
            ON configurazioni_condizionali(conditional_config, priority)
        """)
        
        # Indice per storico (filtro per setup_name e timestamp per grafici)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_storico_name_timestamp 
            ON configurazioni_storico(setup_name, timestamp)
        """)
        
        self.conn.commit()
        
        # Carica tutte le configurazioni in memoria per eliminare query ripetute
        self._load_all_to_memory()
        
        _LOGGER.info("Database inizializzato con indici ottimizzati e cache in-memory: %s", self.db_path)
    
    def _get_configurations_at_time(self, target_datetime: datetime) -> Dict[str, Any]:
        """
        LOGICA UNIFICATA: Ottiene tutte le configurazioni per un timestamp specifico.
        Questa funzione è usata sia da get_all_configurations (runtime) che da simulate_configuration_schedule.
        
        OTTIMIZZAZIONI PERFORMANCE:
        - USA CACHE IN-MEMORY invece di query ripetute (elimina ~40 query/minuto)
        - Filtraggio in Python su dati già in RAM
        - Valutazione lazy dei condizionali (solo se attivi)
        
        NOTA PERFORMANCE: Questa funzione calcola SEMPRE tutte le configurazioni esistenti,
        anche quando servirebbe solo il valore di setup_name specifici. Questo è necessario
        perché le configurazioni condizionali possono creare dipendenze transitive
        (A dipende da B che dipende da C). Senza conoscere tutti i valori, non si può
        risolvere correttamente la priorità globale.
        
        Tuttavia, in contesti come get_next_changes(), questo porta a calcolare
        inutilmente centinaia/migliaia di configurazioni per evento futuro.
        
        Args:
            target_datetime: Il momento per cui calcolare le configurazioni attive
        
        Returns:
            Dict con tutte le configurazioni risolte ricorsivamente per quel momento
        """
        # Assicurati che la cache sia caricata
        if not self._memory_cache['loaded']:
            self._load_all_to_memory()
        
        current_day = target_datetime.weekday()
        current_time = target_datetime.hour + target_datetime.minute / 60.0
        
        # Raccogli tutte le configurazioni attive per questo timestamp
        all_active_configs = []
        
        # Configurazioni a tempo attive - FILTRA DA CACHE IN-MEMORY
        for row in self._memory_cache['configurazioni_a_tempo']:
            if not row['enabled']:
                continue
            
            # Verifica validità temporale
            valid_from = datetime.fromisoformat(row['valid_from_date'])
            valid_to = datetime.fromisoformat(row['valid_to_date'])
            if not (valid_from <= target_datetime <= valid_to):
                continue
            
            # Verifica filtri opzionali orari
            if row['valid_from_ora'] is not None and row['valid_to_ora'] is not None:
                valid_from = row['valid_from_ora']
                valid_to = row['valid_to_ora']
                
                is_valid_time = False
                # Caso speciale: se from == to significa 24 ore (sempre attivo)
                if valid_from == valid_to:
                    is_valid_time = True
                elif valid_to < valid_from:  # Attraversa la mezzanotte
                    is_valid_time = (current_time >= valid_from or current_time <= valid_to)
                else:
                    is_valid_time = (valid_from <= current_time <= valid_to)
                
                if not is_valid_time:
                    continue
            
            # Verifica filtri opzionali giorni
            if row['days_of_week'] is not None:
                valid_days = [int(d) for d in row['days_of_week'].split(',') if d]
                if current_day not in valid_days:
                    continue
            
            all_active_configs.append({
                'setup_name': row['setup_name'],
                'value': row['setup_value'],
                'priority': row['priority'],
                'source': 'time',
                'source_order': 1,
                'id': row['id']
            })
        
        # Configurazioni a orario attive - FILTRA DA CACHE IN-MEMORY
        for row in self._memory_cache['configurazioni_a_orario']:
            if not row['enabled']:
                continue
            days_of_week = row['days_of_week'] if row['days_of_week'] else '0,1,2,3,4,5,6'
            valid_days = [int(d) for d in days_of_week.split(',') if d]
            
            valid_from = row['valid_from_ora']
            valid_to = row['valid_to_ora']
            
            # Verifica validità oraria
            is_valid = False
            # Caso speciale: se from == to significa 24 ore (sempre attivo)
            if valid_from == valid_to:
                is_valid = True
            elif valid_to < valid_from:  # Attraversa la mezzanotte
                is_valid = (current_time >= valid_from or current_time <= valid_to)
            else:
                is_valid = (valid_from <= current_time <= valid_to)
            
            # Verifica giorno valido
            if is_valid and current_day in valid_days:
                all_active_configs.append({
                    'setup_name': row['setup_name'],
                    'value': row['setup_value'],
                    'priority': row['priority'],
                    'source': 'schedule',
                    'source_order': 2,
                    'id': row['id']
                })
        
        # Configurazioni standard (sempre attive) - DA CACHE IN-MEMORY
        for row in self._memory_cache['configurazioni']:
            if not row['enabled']:
                continue
            all_active_configs.append({
                'setup_name': row['setup_name'],
                'value': row['setup_value'],
                'priority': row['priority'],
                'source': 'standard',
                'source_order': 4,
                'id': row['id']
            })
        
        # Configurazioni condizionali (valutate ricorsivamente) - DA CACHE IN-MEMORY
        conditional_configs = [row for row in self._memory_cache['configurazioni_condizionali'] if row['enabled']]
        
        # Prima ordina per priorità, poi valuta le condizioni
        all_active_configs.sort(key=lambda x: (x['priority'], x['source_order']))
        
        # Crea risultato provvisorio per poter valutare le condizioni
        temp_result = {}
        for config in all_active_configs:
            name = config['setup_name']
            if name not in temp_result:
                temp_result[name] = config['value']
        
        # BUGFIX: Valutazione iterativa dei condizionali per risolvere dipendenze tra condizionali
        # Es: Se profilo_temperatura dipende da tipo_sveglia (condizionale 1)
        #     E accensione_automatica dipende da profilo_temperatura (condizionale 2)
        #     Il condizionale 2 deve usare il valore del condizionale 1, non il valore standard
        
        def evaluate_single_conditional(config_row, current_values):
            """Valuta un singolo condizionale usando i valori correnti."""
            base_config = config_row['conditional_config']
            actual_value = current_values.get(base_config)
            
            if actual_value is None:
                return None
            
            # Valuta la condizione
            operator = config_row['conditional_operator']
            expected_value = config_row['conditional_value']
            condition_met = self._evaluate_condition(actual_value, operator, expected_value)
            
            if not condition_met:
                return None
            
            # Verifica filtro orario se presente
            if config_row['valid_from_ora'] is not None and config_row['valid_to_ora'] is not None:
                valid_from = config_row['valid_from_ora']
                valid_to = config_row['valid_to_ora']
                
                is_valid_time = False
                # Caso speciale: se from == to significa 24 ore (sempre attivo)
                if valid_from == valid_to:
                    is_valid_time = True
                elif valid_to < valid_from:  # Attraversa la mezzanotte
                    is_valid_time = (current_time >= valid_from or current_time <= valid_to)
                else:
                    is_valid_time = (valid_from <= current_time <= valid_to)
                
                if not is_valid_time:
                    return None
            
            return {
                'setup_name': config_row['setup_name'],
                'value': config_row['setup_value'],
                'priority': config_row['priority'],
                'source': 'conditional',
                'source_order': 0,
                'conditional_config': base_config,
                'conditional_operator': operator,
                'conditional_value': expected_value,
                'id': config_row['id']
            }
        
        # Valutazione iterativa: ripeti fino a convergenza (max 10 iterazioni per sicurezza)
        max_iterations = 10
        for iteration in range(max_iterations):
            previous_values = temp_result.copy()
            
            # Valuta tutti i condizionali con i valori correnti
            evaluated_conditionals = []
            for row in conditional_configs:
                result = evaluate_single_conditional(row, temp_result)
                if result:
                    evaluated_conditionals.append(result)
            
            # Aggiungi i condizionali valutati a all_active_configs (rimuovi quelli precedenti)
            all_active_configs = [c for c in all_active_configs if c['source'] != 'conditional']
            all_active_configs.extend(evaluated_conditionals)
            
            # Riordina e aggiorna temp_result
            all_active_configs.sort(key=lambda x: (x['priority'], x['source_order']))
            temp_result = {}
            for config in all_active_configs:
                name = config['setup_name']
                if name not in temp_result:
                    temp_result[name] = config['value']
            
            # Controlla convergenza: se i valori non cambiano, abbiamo finito
            if temp_result == previous_values:
                break
        
        # Ordina per priorità (crescente) e poi per source_order (crescente)
        all_active_configs.sort(key=lambda x: (x['priority'], x['source_order']))
        
        # Seleziona la prima configurazione per ogni setup_name
        result = {}
        for config in all_active_configs:
            name = config['setup_name']
            if name not in result:
                result[name] = {
                    'value': config['value'],
                    'source': config['source'],
                    'priority': config['priority'],
                    'id': config['id']
                }
        
        return result

    def get_all_configurations(self) -> Dict[str, Any]:
        """
        Ottiene tutte le configurazioni applicando la logica di priorità globale.
        Usa la logica unificata _get_configurations_at_time con timestamp = now.
        
        OTTIMIZZAZIONI:
        - Cache delle descrizioni (TTL 60s) per evitare query ripetute
        - Usa la logica unificata _get_configurations_at_time con indici DB
        """
        # Usa la logica unificata per il momento attuale
        now = datetime.now()
        result = self._get_configurations_at_time(now)
        
        # Cache delle descrizioni per 60 secondi (raramente cambiano)
        current_time = now.timestamp()
        if (self._descriptions_cache is None or 
            self._cache_timestamp is None or 
            current_time - self._cache_timestamp > 60):
            
            cursor = self.conn.cursor()
            cursor.execute("SELECT setup_name, description FROM configurazioni_descrizioni")
            self._descriptions_cache = {row['setup_name']: row['description'] for row in cursor.fetchall()}
            self._cache_timestamp = current_time
        
        # Aggiungi le descrizioni al risultato dalla cache
        for name in result:
            result[name]['description'] = self._descriptions_cache.get(name)
        
        return result
    
    def get_configuration(self, setup_name: str) -> Optional[Dict[str, Any]]:
        """Ottiene una specifica configurazione applicando la logica di priorità."""
        # Nota: attualmente richiede il calcolo di tutte le configurazioni a causa delle dipendenze condizionali
        # che possono creare catene transitive (A dipende da B che dipende da C, ecc.)
        all_configs = self.get_all_configurations()
        return all_configs.get(setup_name)
    
    def _invalidate_next_changes_cache(self):
        """Invalida la cache dei prossimi cambiamenti dopo modifiche alle configurazioni.
        
        Chiamato automaticamente da tutti i metodi che modificano le configurazioni
        (set_config, set_time_config, delete_config, etc.) per garantire che
        get_next_changes ricalcoli i risultati dopo cambiamenti al setup.
        
        INOLTRE: Ricarica la cache in-memory per riflettere le modifiche al DB.
        """
        self._next_changes_cache.clear()
        self._config_version += 1
        
        # Ricarica la cache in-memory dopo modifiche (mantiene tutto sincronizzato)
        self._load_all_to_memory()
        _LOGGER.debug(f"Cache invalidata e ricaricata (config_version: {self._config_version})")
    
    def _check_priority_conflict(self, setup_name: str, priority: int, exclude_id: int = None) -> bool:
        """Verifica se esiste già una configurazione standard con la stessa priorità per questo nome."""
        cursor = self.conn.cursor()
        if exclude_id:
            cursor.execute("""
                SELECT id FROM configurazioni 
                WHERE setup_name = ? AND priority = ? AND id != ?
            """, (setup_name, priority, exclude_id))
        else:
            cursor.execute("""
                SELECT id FROM configurazioni 
                WHERE setup_name = ? AND priority = ?
            """, (setup_name, priority))
        return cursor.fetchone() is not None
    
    def set_config(self, setup_name: str, setup_value: str, priority: int = 99, description: str = None) -> None:
        """Imposta una configurazione standard."""
        setup_name = self.validate_setup_name(setup_name)
        
        # Verifica conflitto di priorità
        if self._check_priority_conflict(setup_name, priority):
            raise ValueError(f"Esiste già una configurazione '{setup_name}' con priorità {priority}")
        
        cursor = self.conn.cursor()
        
        # Inserisci la nuova configurazione (permette duplicati con priorità diverse)
        cursor.execute("""
            INSERT INTO configurazioni (setup_name, setup_value, priority)
            VALUES (?, ?, ?)
        """, (setup_name, setup_value, priority))
        
        # Salva/aggiorna descrizione se fornita (una sola per setup_name)
        if description is not None:
            cursor.execute("""
                INSERT OR REPLACE INTO configurazioni_descrizioni (setup_name, description)
                VALUES (?, ?)
            """, (setup_name, description))
            # Invalida cache descrizioni
            self._descriptions_cache = None
        
        # Salva nello storico
        self._save_to_history(
            setup_name, 'standard',
            {'setup_value': setup_value, 'priority': priority},
            'INSERT'
        )
        
        self.conn.commit()
        _LOGGER.debug(f"Set config: {setup_name} = {setup_value} (priority: {priority})")
        
        # Invalida cache next_changes dopo modifica configurazione
        self._invalidate_next_changes_cache()
    
    def update_standard_config(self, config_id: int, setup_value: str, priority: int, description: str = None) -> None:
        """Aggiorna una configurazione standard esistente."""
        cursor = self.conn.cursor()
        
        # Ottieni configurazione corrente
        cursor.execute("SELECT * FROM configurazioni WHERE id = ?", (config_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Configurazione con id {config_id} non trovata")
        
        setup_name = row['setup_name']
        
        # Verifica conflitto di priorità (escludendo l'id corrente)
        if self._check_priority_conflict(setup_name, priority, exclude_id=config_id):
            raise ValueError(f"Esiste già una configurazione '{setup_name}' con priorità {priority}")
        
        # Aggiorna configurazione
        cursor.execute("""
            UPDATE configurazioni 
            SET setup_value = ?, priority = ?
            WHERE id = ?
        """, (setup_value, priority, config_id))
        
        # Aggiorna descrizione se fornita
        if description is not None:
            cursor.execute("""
                INSERT OR REPLACE INTO configurazioni_descrizioni (setup_name, description)
                VALUES (?, ?)
            """, (setup_name, description))
            # Invalida cache descrizioni
            self._descriptions_cache = None
        
        # Salva nello storico
        self._save_to_history(
            setup_name, 'standard',
            {'setup_value': setup_value, 'priority': priority},
            'UPDATE'
        )
        
        self.conn.commit()
        _LOGGER.debug(f"Updated config id {config_id}: {setup_name} = {setup_value} (priority: {priority})")
        
        # Invalida cache next_changes dopo modifica configurazione
        self._invalidate_next_changes_cache()
    
    def set_time_config(
        self, 
        setup_name: str, 
        setup_value: str, 
        valid_from_date: str, 
        valid_to_date: str,
        priority: int = 99,
        valid_from_ora: float = None,
        valid_to_ora: float = None,
        days_of_week: str = None
    ) -> None:
        """Imposta una configurazione a tempo con filtri opzionali per orario e giorni."""
        setup_name = self.validate_setup_name(setup_name)
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO configurazioni_a_tempo 
            (setup_name, setup_value, valid_from_date, valid_to_date, priority, valid_from_ora, valid_to_ora, days_of_week)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (setup_name, setup_value, valid_from_date, valid_to_date, priority, valid_from_ora, valid_to_ora, days_of_week))
        
        # Salva nello storico
        self._save_to_history(
            setup_name, 'time',
            {
                'setup_value': setup_value,
                'valid_from_date': str(valid_from_date),
                'valid_to_date': str(valid_to_date),
                'priority': priority
            },
            'INSERT'
        )
        
        self.conn.commit()
        _LOGGER.debug(f"Set time config: {setup_name} = {setup_value} ({valid_from_date} - {valid_to_date})")
        
        # Invalida cache next_changes dopo modifica configurazione
        self._invalidate_next_changes_cache()
    
    def set_schedule_config(
        self, 
        setup_name: str, 
        setup_value: str, 
        valid_from_ora: float, 
        valid_to_ora: float,
        days_of_week: str = '0,1,2,3,4,5,6',
        priority: int = 99
    ) -> None:
        """Imposta una configurazione a orario."""
        setup_name = self.validate_setup_name(setup_name)
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO configurazioni_a_orario 
            (setup_name, setup_value, valid_from_ora, valid_to_ora, days_of_week, priority)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (setup_name, setup_value, valid_from_ora, valid_to_ora, days_of_week, priority))
        
        # Salva nello storico
        self._save_to_history(
            setup_name, 'schedule',
            {
                'setup_value': setup_value,
                'valid_from_ora': valid_from_ora,
                'valid_to_ora': valid_to_ora,
                'days_of_week': days_of_week
            },
            'INSERT'
        )
        
        self.conn.commit()
        _LOGGER.debug(f"Set schedule config: {setup_name} = {setup_value} ({valid_from_ora} - {valid_to_ora}) Days: {days_of_week}")
        
        # Invalida cache next_changes dopo modifica configurazione
        self._invalidate_next_changes_cache()
    
    def set_conditional_config(
        self,
        setup_name: str,
        setup_value: str,
        conditional_config: str,
        conditional_operator: str,
        conditional_value: str,
        priority: int = 99,
        valid_from_ora: float = None,
        valid_to_ora: float = None
    ) -> None:
        """Imposta una configurazione condizionale."""
        setup_name = self.validate_setup_name(setup_name)
        conditional_config = self.validate_setup_name(conditional_config)
        
        # Verifica loop diretto
        if setup_name == conditional_config:
            raise ValueError(f"Una configurazione non può dipendere da se stessa")
        
        # Verifica loop ciclici
        if self._check_circular_dependency(setup_name, conditional_config):
            raise ValueError(
                f"Dipendenza ciclica rilevata: '{setup_name}' non può dipendere da '{conditional_config}' "
                f"perché creerebbe un loop infinito"
            )
        
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO configurazioni_condizionali
            (setup_name, setup_value, conditional_config, conditional_operator, conditional_value, 
             valid_from_ora, valid_to_ora, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (setup_name, setup_value, conditional_config, conditional_operator, conditional_value,
              valid_from_ora, valid_to_ora, priority))
        
        # Salva nello storico
        history_data = {
            'setup_value': setup_value,
            'conditional_config': conditional_config,
            'conditional_operator': conditional_operator,
            'conditional_value': conditional_value,
            'priority': priority
        }
        if valid_from_ora is not None:
            history_data['valid_from_ora'] = valid_from_ora
        if valid_to_ora is not None:
            history_data['valid_to_ora'] = valid_to_ora
        
        self._save_to_history(
            setup_name, 'conditional',
            history_data,
            'INSERT'
        )
        
        self.conn.commit()
        _LOGGER.debug(f"Set conditional config: {setup_name} = {setup_value} if {conditional_config} {conditional_operator} {conditional_value}")
        
        # Invalida cache next_changes dopo modifica configurazione
        self._invalidate_next_changes_cache()
    
    def _check_circular_dependency(self, setup_name: str, conditional_config: str, visited: set = None) -> bool:
        """Verifica se aggiungere una dipendenza creerebbe un loop ciclico.
        
        Args:
            setup_name: Nome della configurazione che stiamo aggiungendo
            conditional_config: Configurazione da cui dipende
            visited: Set di configurazioni già visitate (per rilevare cicli)
        
        Returns:
            True se esiste un ciclo, False altrimenti
        """
        if visited is None:
            visited = set()
        
        # Se conditional_config punta direttamente a setup_name, è un ciclo diretto
        if conditional_config == setup_name:
            return True
        
        # Se abbiamo già visitato conditional_config, abbiamo trovato un ciclo
        if conditional_config in visited:
            return True
        
        visited.add(conditional_config)
        
        # Trova tutte le configurazioni condizionali dove conditional_config è il setup_name
        # (cioè dove conditional_config a sua volta dipende da altre configurazioni)
        cursor = self.conn.cursor()
        cursor.row_factory = sqlite3.Row
        cursor.execute("""
            SELECT conditional_config FROM configurazioni_condizionali
            WHERE setup_name = ?
        """, (conditional_config,))
        
        for row in cursor.fetchall():
            next_dependency = row['conditional_config']
            # Se questa dipendenza punta a setup_name, abbiamo un ciclo
            if next_dependency == setup_name:
                return True
            # Ricorsivamente controlla le dipendenze
            if self._check_circular_dependency(setup_name, next_dependency, visited.copy()):
                return True
        
        return False
    
    def _evaluate_condition(self, actual_value: str, operator: str, expected_value: str) -> bool:
        """Valuta una condizione confrontando due valori.
        
        Args:
            actual_value: Valore attuale della configurazione
            operator: Operatore di confronto
            expected_value: Valore atteso
        
        Returns:
            True se la condizione è soddisfatta, False altrimenti
        """
        # Prova a convertire in numeri per confronti numerici
        try:
            actual_num = float(actual_value)
            expected_num = float(expected_value)
            is_numeric = True
        except (ValueError, TypeError):
            is_numeric = False
        
        if operator == '==':
            return str(actual_value) == str(expected_value)
        elif operator == '!=':
            return str(actual_value) != str(expected_value)
        elif operator == 'contains':
            return str(expected_value).lower() in str(actual_value).lower()
        elif operator == 'not_contains':
            return str(expected_value).lower() not in str(actual_value).lower()
        elif is_numeric:
            if operator == '>':
                return actual_num > expected_num
            elif operator == '<':
                return actual_num < expected_num
            elif operator == '>=':
                return actual_num >= expected_num
            elif operator == '<=':
                return actual_num <= expected_num
        
        return False
    
    def delete_config(self, setup_name: str, config_type: str = "all") -> None:
        """Elimina una configurazione."""
        cursor = self.conn.cursor()
        
        if config_type in ["all", "standard"]:
            # Salva nello storico prima di eliminare
            cursor.execute("SELECT * FROM configurazioni WHERE setup_name = ?", (setup_name,))
            row = cursor.fetchone()
            if row:
                self._save_to_history(
                    setup_name, 'standard',
                    {'setup_value': row['setup_value'], 'priority': row['priority']},
                    'DELETE'
                )
            cursor.execute("DELETE FROM configurazioni WHERE setup_name = ?", (setup_name,))
        
        if config_type in ["all", "time"]:
            # Salva nello storico prima di eliminare
            cursor.execute("SELECT * FROM configurazioni_a_tempo WHERE setup_name = ?", (setup_name,))
            for row in cursor.fetchall():
                self._save_to_history(
                    setup_name, 'time',
                    {
                        'setup_value': row['setup_value'],
                        'valid_from_date': row['valid_from_date'],
                        'valid_to_date': row['valid_to_date']
                    },
                    'DELETE'
                )
            cursor.execute("DELETE FROM configurazioni_a_tempo WHERE setup_name = ?", (setup_name,))
        
        if config_type in ["all", "schedule"]:
            # Salva nello storico prima di eliminare
            cursor.execute("SELECT * FROM configurazioni_a_orario WHERE setup_name = ?", (setup_name,))
            for row in cursor.fetchall():
                self._save_to_history(
                    setup_name, 'schedule',
                    {
                        'setup_value': row['setup_value'],
                        'valid_from_ora': row['valid_from_ora'],
                        'valid_to_ora': row['valid_to_ora'],
                        'days_of_week': row['days_of_week']
                    },
                    'DELETE'
                )
            cursor.execute("DELETE FROM configurazioni_a_orario WHERE setup_name = ?", (setup_name,))
        
        if config_type in ["all", "conditional"]:
            # Salva nello storico prima di eliminare
            cursor.execute("""
                SELECT setup_name, setup_value, conditional_config, conditional_operator, 
                       conditional_value, valid_from_ora, valid_to_ora, priority
                FROM configurazioni_condizionali 
                WHERE setup_name = ?
            """, (setup_name,))
            for row in cursor.fetchall():
                self._save_to_history(
                    setup_name, 'conditional',
                    {
                        'setup_value': row['setup_value'],
                        'conditional_config': row['conditional_config'],
                        'conditional_operator': row['conditional_operator'],
                        'conditional_value': row['conditional_value']
                    },
                    'DELETE'
                )
            cursor.execute("DELETE FROM configurazioni_condizionali WHERE setup_name = ?", (setup_name,))
        
        # Invalida cache descrizioni (potrebbero essere state rimosse insieme alle config)
        self._descriptions_cache = None
        
        self.conn.commit()
        _LOGGER.debug(f"Deleted config: {setup_name} (type: {config_type})")
        
        # Invalida cache next_changes dopo eliminazione configurazione
        self._invalidate_next_changes_cache()
    
    def get_all_setup_names(self) -> List[str]:
        """Ottiene tutti i nomi delle configurazioni esistenti usando la cache in-memory."""
        # Assicurati che la cache sia caricata
        if not self._memory_cache['loaded']:
            self._load_all_to_memory()
        
        names = set()
        
        # Estrai nomi dalla cache invece di fare query dirette
        names.update(row['setup_name'] for row in self._memory_cache['configurazioni'])
        names.update(row['setup_name'] for row in self._memory_cache['configurazioni_a_orario'])
        names.update(row['setup_name'] for row in self._memory_cache['configurazioni_a_tempo'])
        names.update(row['setup_name'] for row in self._memory_cache['configurazioni_condizionali'])
        
        return sorted(list(names))
    
    def get_all_configurations_detailed(self) -> Dict[str, List[Dict[str, Any]]]:
        """Ottiene tutte le configurazioni con tutti i dettagli, raggruppate per nome usando la cache in-memory."""
        # Assicurati che la cache sia caricata
        if not self._memory_cache['loaded']:
            self._load_all_to_memory()
        
        result = {}
        
        # Configurazioni standard (con descrizione dalla cache)
        for row in self._memory_cache['configurazioni']:
            name = row['setup_name']
            if name not in result:
                result[name] = []
            config_dict = {
                'type': 'standard',
                'id': row['id'],
                'value': row['setup_value'],
                'priority': row['priority'],
                'enabled': bool(row['enabled'])
            }
            # Aggiungi descrizione dalla cache se presente
            description = self._memory_cache['descrizioni'].get(name)
            if description:
                config_dict['description'] = description
            result[name].append(config_dict)
        
        # Configurazioni a orario
        for row in self._memory_cache['configurazioni_a_orario']:
            name = row['setup_name']
            if name not in result:
                result[name] = []
            days_str = row['days_of_week'] if row['days_of_week'] else '0,1,2,3,4,5,6'  # Default a tutti i giorni se None o vuoto
            result[name].append({
                'type': 'schedule',
                'id': row['id'],
                'value': row['setup_value'],
                'valid_from_ora': row['valid_from_ora'],
                'valid_to_ora': row['valid_to_ora'],
                'days_of_week': [int(d) for d in days_str.split(',') if d],
                'priority': row['priority'],
                'enabled': bool(row['enabled'])
            })
        
        # Configurazioni a tempo
        for row in self._memory_cache['configurazioni_a_tempo']:
            name = row['setup_name']
            if name not in result:
                result[name] = []
            config_dict = {
                'type': 'time',
                'id': row['id'],
                'value': row['setup_value'],
                'valid_from_date': row['valid_from_date'],
                'valid_to_date': row['valid_to_date'],
                'priority': row['priority'],
                'enabled': bool(row['enabled'])
            }
            # Aggiungi filtri opzionali se presenti
            if row['valid_from_ora'] is not None:
                config_dict['valid_from_ora'] = row['valid_from_ora']
            if row['valid_to_ora'] is not None:
                config_dict['valid_to_ora'] = row['valid_to_ora']
            if row['days_of_week'] is not None:
                config_dict['days_of_week'] = [int(d) for d in row['days_of_week'].split(',') if d]
            
            result[name].append(config_dict)
        
        # Configurazioni condizionali
        for row in self._memory_cache['configurazioni_condizionali']:
            name = row['setup_name']
            if name not in result:
                result[name] = []
            config_dict = {
                'type': 'conditional',
                'id': row['id'],
                'value': row['setup_value'],
                'conditional_config': row['conditional_config'],
                'conditional_operator': row['conditional_operator'],
                'conditional_value': row['conditional_value'],
                'priority': row['priority'],
                'enabled': bool(row['enabled'])
            }
            # Aggiungi filtri temporali se presenti
            if row['valid_from_ora'] is not None:
                config_dict['valid_from_ora'] = row['valid_from_ora']
            if row['valid_to_ora'] is not None:
                config_dict['valid_to_ora'] = row['valid_to_ora']
            result[name].append(config_dict)
        return result
    
    def get_history(self, setup_name: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Ottiene lo storico delle configurazioni con paginazione."""
        cursor = self.conn.cursor()
        
        if setup_name:
            cursor.execute("""
                SELECT * FROM configurazioni_storico 
                WHERE setup_name = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """, (setup_name, limit, offset))
        else:
            cursor.execute("""
                SELECT * FROM configurazioni_storico 
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """, (limit, offset))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_history_count(self, setup_name: Optional[str] = None) -> int:
        """Ottiene il numero totale di record nello storico."""
        cursor = self.conn.cursor()
        
        if setup_name:
            cursor.execute("""
                SELECT COUNT(*) as count FROM configurazioni_storico 
                WHERE setup_name = ?
            """, (setup_name,))
        else:
            cursor.execute("""
                SELECT COUNT(*) as count FROM configurazioni_storico
            """)
        
        result = cursor.fetchone()
        return result['count'] if result else 0
    
    def _save_to_history(self, setup_name: str, config_type: str, config_data: Dict[str, Any], operation: str) -> None:
        """Salva una configurazione nello storico."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO configurazioni_storico 
            (setup_name, config_type, setup_value, priority, valid_from_ora, valid_to_ora, 
             days_of_week, valid_from_date, valid_to_date, operation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            setup_name,
            config_type,
            config_data.get('setup_value'),
            config_data.get('priority'),
            config_data.get('valid_from_ora'),
            config_data.get('valid_to_ora'),
            config_data.get('days_of_week'),
            config_data.get('valid_from_date'),
            config_data.get('valid_to_date'),
            operation
        ))
        self.conn.commit()
        
        # Dopo aver salvato, esegui il cleanup dello storico
        self._cleanup_history(setup_name)
    
    def _cleanup_history(self, setup_name: str, retention_days: int = 730, max_entries_per_name: int = 100, min_entries_per_name: int = 10) -> None:
        """
        Pulisce lo storico applicando le regole:
        1. Mantieni sempre almeno min_entries_per_name entry più recenti (anche se oltre retention_days)
        2. Elimina entry oltre retention_days solo se abbiamo più di min_entries_per_name
        3. Mantieni massimo max_entries_per_name entry
        """
        cursor = self.conn.cursor()
        
        # Conta quante entry abbiamo per questo setup_name
        cursor.execute("""
            SELECT COUNT(*) as count FROM configurazioni_storico 
            WHERE setup_name = ?
        """, (setup_name,))
        total_count = cursor.fetchone()['count']
        
        # Se abbiamo più di max_entries_per_name, elimina le più vecchie oltre il massimo
        if total_count > max_entries_per_name:
            cursor.execute("""
                DELETE FROM configurazioni_storico
                WHERE id NOT IN (
                    SELECT id FROM configurazioni_storico
                    WHERE setup_name = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                )
                AND setup_name = ?
            """, (setup_name, max_entries_per_name, setup_name))
            
            # Aggiorna il conteggio
            cursor.execute("""
                SELECT COUNT(*) as count FROM configurazioni_storico 
                WHERE setup_name = ?
            """, (setup_name,))
            total_count = cursor.fetchone()['count']
        
        # Elimina record più vecchi di retention_days SOLO se abbiamo più di min_entries_per_name
        if total_count > min_entries_per_name:
            cursor.execute("""
                DELETE FROM configurazioni_storico
                WHERE id IN (
                    SELECT id FROM configurazioni_storico
                    WHERE setup_name = ?
                    AND datetime(timestamp) < datetime('now', '-' || ? || ' days')
                    AND id NOT IN (
                        SELECT id FROM configurazioni_storico
                        WHERE setup_name = ?
                        ORDER BY timestamp DESC
                        LIMIT ?
                    )
                )
            """, (setup_name, retention_days, setup_name, min_entries_per_name))
        
        self.conn.commit()
        _LOGGER.debug(f"Cleanup storico per '{setup_name}': retention={retention_days} giorni, max={max_entries_per_name}, min={min_entries_per_name}")
    
    def delete_single_config(self, config_type: str, config_id: str) -> None:
        """Elimina una singola configurazione per ID."""
        cursor = self.conn.cursor()
        
        # Salva nello storico prima di eliminare
        if config_type == 'schedule':
            cursor.execute("SELECT * FROM configurazioni_a_orario WHERE id = ?", (int(config_id),))
            row = cursor.fetchone()
            if row:
                self._save_to_history(
                    row['setup_name'], 'schedule',
                    {
                        'setup_value': row['setup_value'],
                        'valid_from_ora': row['valid_from_ora'],
                        'valid_to_ora': row['valid_to_ora'],
                        'days_of_week': row['days_of_week']
                    },
                    'DELETE'
                )
            cursor.execute("DELETE FROM configurazioni_a_orario WHERE id = ?", (int(config_id),))
        elif config_type == 'time':
            cursor.execute("SELECT * FROM configurazioni_a_tempo WHERE id = ?", (int(config_id),))
            row = cursor.fetchone()
            if row:
                self._save_to_history(
                    row['setup_name'], 'time',
                    {
                        'setup_value': row['setup_value'],
                        'valid_from_date': row['valid_from_date'],
                        'valid_to_date': row['valid_to_date']
                    },
                    'DELETE'
                )
            cursor.execute("DELETE FROM configurazioni_a_tempo WHERE id = ?", (int(config_id),))
        elif config_type == 'conditional':
            cursor.execute("""
                SELECT setup_name, setup_value, conditional_config, conditional_operator, 
                       conditional_value, valid_from_ora, valid_to_ora, priority
                FROM configurazioni_condizionali 
                WHERE id = ?
            """, (int(config_id),))
            row = cursor.fetchone()
            if row:
                self._save_to_history(
                    row['setup_name'], 'conditional',
                    {
                        'setup_value': row['setup_value'],
                        'conditional_config': row['conditional_config'],
                        'conditional_operator': row['conditional_operator'],
                        'conditional_value': row['conditional_value']
                    },
                    'DELETE'
                )
            cursor.execute("DELETE FROM configurazioni_condizionali WHERE id = ?", (int(config_id),))
        elif config_type == 'standard':
            # Per standard usiamo il nome come identificatore
            cursor.execute("SELECT * FROM configurazioni WHERE setup_name = ?", (config_id,))
            row = cursor.fetchone()
            if row:
                self._save_to_history(
                    row['setup_name'], 'standard',
                    {'setup_value': row['setup_value'], 'priority': row['priority']},
                    'DELETE'
                )
            cursor.execute("DELETE FROM configurazioni WHERE setup_name = ?", (config_id,))
        
        self.conn.commit()
        _LOGGER.info(f"Configurazione {config_type} con ID {config_id} eliminata")
        
        # Invalida cache next_changes dopo eliminazione configurazione
        self._invalidate_next_changes_cache()
    
    def set_config_enabled(self, config_type: str, config_id: int, enabled: bool) -> None:
        """Abilita o disabilita una configurazione."""
        cursor = self.conn.cursor()
        enabled_value = 1 if enabled else 0
        history_data = None
        history_name = None
        
        table_map = {
            'schedule': 'configurazioni_a_orario',
            'time': 'configurazioni_a_tempo',
            'conditional': 'configurazioni_condizionali',
            'standard': 'configurazioni'
        }
        
        if config_type not in table_map:
            raise ValueError(f"Tipo configurazione non valido: {config_type}")
        
        table = table_map[config_type]

        # Recupera i dati correnti per loggare l'operazione nello storico
        if config_type == 'schedule':
            cursor.execute("SELECT setup_name, setup_value, valid_from_ora, valid_to_ora, days_of_week FROM configurazioni_a_orario WHERE id = ?", (config_id,))
            row = cursor.fetchone()
            if row:
                history_name = row['setup_name']
                history_data = {
                    'setup_value': row['setup_value'],
                    'valid_from_ora': row['valid_from_ora'],
                    'valid_to_ora': row['valid_to_ora'],
                    'days_of_week': row['days_of_week']
                }
        elif config_type == 'time':
            cursor.execute("SELECT setup_name, setup_value, valid_from_date, valid_to_date, valid_from_ora, valid_to_ora, days_of_week FROM configurazioni_a_tempo WHERE id = ?", (config_id,))
            row = cursor.fetchone()
            if row:
                history_name = row['setup_name']
                history_data = {
                    'setup_value': row['setup_value'],
                    'valid_from_date': row['valid_from_date'],
                    'valid_to_date': row['valid_to_date'],
                    'valid_from_ora': row['valid_from_ora'],
                    'valid_to_ora': row['valid_to_ora'],
                    'days_of_week': row['days_of_week']
                }
        elif config_type == 'conditional':
            cursor.execute("""
                SELECT setup_name, setup_value, conditional_config, conditional_operator, conditional_value, valid_from_ora, valid_to_ora
                FROM configurazioni_condizionali
                WHERE id = ?
            """, (config_id,))
            row = cursor.fetchone()
            if row:
                history_name = row['setup_name']
                history_data = {
                    'setup_value': row['setup_value'],
                    'conditional_config': row['conditional_config'],
                    'conditional_operator': row['conditional_operator'],
                    'conditional_value': row['conditional_value'],
                    'valid_from_ora': row['valid_from_ora'],
                    'valid_to_ora': row['valid_to_ora']
                }
        elif config_type == 'standard':
            cursor.execute("SELECT setup_name, setup_value, priority FROM configurazioni WHERE id = ?", (config_id,))
            row = cursor.fetchone()
            if row:
                history_name = row['setup_name']
                history_data = {
                    'setup_value': row['setup_value'],
                    'priority': row['priority']
                }
        cursor.execute(f"UPDATE {table} SET enabled = ? WHERE id = ?", (enabled_value, config_id))
        self.conn.commit()
        
        if history_name and history_data:
            operation = 'ENABLE' if enabled else 'DISABLE'
            self._save_to_history(history_name, config_type, history_data, operation)

        status = "abilitata" if enabled else "disabilitata"
        _LOGGER.info(f"Configurazione {config_type} con ID {config_id} {status}")
        
        # Invalida cache next_changes dopo modifica enable/disable
        self._invalidate_next_changes_cache()
    
    def get_next_changes(self, setup_name: str, limit_hours: int = 24, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        Calcola i prossimi cambiamenti di valore per una configurazione.
        USA LA LOGICA UNIFICATA _get_configurations_at_time per garantire coerenza con runtime e vista settimanale.
        
        OTTIMIZZAZIONE PERFORMANCE:
        - Cache basata sul valore corrente e config_version
        - Ricalcolo solo se: valore corrente cambiato O configurazioni modificate
        - La cache viene invalidata automaticamente dopo ogni modifica alle configurazioni
        
        Args:
            setup_name: Nome della configurazione per cui calcolare i prossimi cambiamenti
            limit_hours: Numero di ore future da considerare (default 24)
            max_results: Numero massimo di eventi da restituire (default 5)
        
        Returns:
            Lista di cambiamenti futuri ordinati per tempo, ognuno con:
            - value: Il nuovo valore che sarà attivo
            - minutes_until: Minuti da ora fino al cambiamento
            - timestamp: Timestamp ISO del cambiamento
            - type: Tipo di evento che causa il cambiamento (time, schedule, conditional, etc.)
        """
        # Ottieni il valore attuale usando la logica unificata
        current_config = self.get_all_configurations()
        current_value = current_config.get(setup_name, {}).get('value')
        current_source = current_config.get(setup_name, {}).get('source', 'unknown')
        
        # Controlla cache: ricalcola solo se valore corrente cambiato O configurazioni modificate
        # Cache key include parametri per evitare collisioni tra chiamate con parametri diversi
        cache_key = (setup_name, limit_hours, max_results)
        cached = self._next_changes_cache.get(cache_key)
        
        if cached is not None:
            # Cache hit: verifica se è ancora valida
            if (cached['value'] == current_value and 
                cached['config_version'] == self._config_version):
                # Cache valida: aggiorna solo minutes_until basandosi sul tempo trascorso
                now = datetime.now()
                cached_timestamp = datetime.fromisoformat(cached['timestamp'])
                # Usa round invece di int per evitare drift nei calcoli temporali
                elapsed_minutes = round((now - cached_timestamp).total_seconds() / 60)
                
                # Aggiorna minutes_until per ogni evento e filtra eventi passati
                updated_changes = []
                for change in cached['result']:
                    new_minutes_until = change['minutes_until'] - elapsed_minutes
                    if new_minutes_until > 0:  # Solo eventi futuri
                        updated_change = change.copy()
                        updated_change['minutes_until'] = new_minutes_until
                        updated_changes.append(updated_change)
                
                # Se troppi eventi sono diventati passati e abbiamo meno di max_results,
                # potremmo perdere eventi futuri -> invalida cache e ricalcola
                if len(cached['result']) > 0 and len(updated_changes) < max_results // 2:
                    # Troppi eventi sono diventati passati, meglio ricalcolare
                    pass  # Continua con il ricalcolo
                else:
                    return updated_changes[:max_results]
        
        # Cache miss o invalidata: ricalcola
        cursor = self.conn.cursor()
        now = datetime.now()
        limit_time = now + timedelta(hours=limit_hours)
        
        # Costanti per la gestione degli eventi
        MAX_DAYS_TO_CHECK = 7  # Numero massimo di giorni futuri da considerare per eventi ricorrenti
        
        # Helper per calcolare giorni da verificare basato su limit_hours
        def get_days_to_check(hours: int) -> int:
            """Calcola quanti giorni verificare per eventi ricorrenti, max MAX_DAYS_TO_CHECK."""
            return min(int(hours / 24) + 2, MAX_DAYS_TO_CHECK)  # +2 per sicurezza (oggi e domani)
        
        # Raccogli tutti i timestamp di eventi potenziali (inizio/fine di configurazioni)
        # IMPORTANTE: Raccogliamo eventi da TUTTE le configurazioni, non solo per setup_name,
        # perché le configurazioni condizionali possono dipendere da altre configurazioni
        event_times = set()
        
        # Eventi da configurazioni a tempo (per setup_name e dipendenze)
        cursor.execute("""
            SELECT valid_from_date, valid_to_date
            FROM configurazioni_a_tempo
            WHERE enabled = 1
        """)
        for row in cursor.fetchall():
            valid_from = datetime.fromisoformat(row['valid_from_date'])
            valid_to = datetime.fromisoformat(row['valid_to_date']) if row['valid_to_date'] else None
            
            if valid_from > now and valid_from <= limit_time:
                event_times.add(valid_from)
            if valid_to and valid_to > now and valid_to <= limit_time:
                event_times.add(valid_to)
        
        # Eventi da configurazioni a orario (per setup_name e dipendenze)
        cursor.execute("""
            SELECT valid_from_ora, valid_to_ora, days_of_week
            FROM configurazioni_a_orario
            WHERE enabled = 1
        """)
        days_to_check = get_days_to_check(limit_hours)
        for row in cursor.fetchall():
            days_str = row['days_of_week'] if row['days_of_week'] else '0,1,2,3,4,5,6'
            days_list = [int(d) for d in days_str.split(',') if d]
            
            for day_offset in range(days_to_check):
                check_date = now + timedelta(days=day_offset)
                weekday = check_date.weekday()
                
                if weekday in days_list:
                    from_decimal = row['valid_from_ora']
                    to_decimal = row['valid_to_ora']
                    
                    from_hour = int(from_decimal)
                    from_min = int((from_decimal - from_hour) * 60)
                    event_from = check_date.replace(hour=from_hour, minute=from_min, second=0, microsecond=0)
                    
                    to_hour = int(to_decimal)
                    to_min = int((to_decimal - to_hour) * 60)
                    
                    if to_decimal < from_decimal:  # Attraversa la mezzanotte
                        event_to = (check_date + timedelta(days=1)).replace(hour=to_hour, minute=to_min, second=0, microsecond=0)
                    else:
                        event_to = check_date.replace(hour=to_hour, minute=to_min, second=0, microsecond=0)
                    
                    if event_from > now and event_from <= limit_time:
                        event_times.add(event_from)
                    if event_to > now and event_to <= limit_time:
                        event_times.add(event_to)
        
        # Eventi da filtri orari di configurazioni condizionali
        cursor.execute("""
            SELECT valid_from_ora, valid_to_ora
            FROM configurazioni_condizionali
            WHERE enabled = 1 AND valid_from_ora IS NOT NULL AND valid_to_ora IS NOT NULL
        """)
        for row in cursor.fetchall():
            for day_offset in range(days_to_check):
                check_date = now + timedelta(days=day_offset)
                
                from_decimal = row['valid_from_ora']
                to_decimal = row['valid_to_ora']
                
                from_hour = int(from_decimal)
                from_min = int((from_decimal - from_hour) * 60)
                event_from = check_date.replace(hour=from_hour, minute=from_min, second=0, microsecond=0)
                
                to_hour = int(to_decimal)
                to_min = int((to_decimal - to_hour) * 60)
                
                if to_decimal < from_decimal:
                    event_to = (check_date + timedelta(days=1)).replace(hour=to_hour, minute=to_min, second=0, microsecond=0)
                else:
                    event_to = check_date.replace(hour=to_hour, minute=to_min, second=0, microsecond=0)
                
                if event_from > now and event_from <= limit_time:
                    event_times.add(event_from)
                if event_to > now and event_to <= limit_time:
                    event_times.add(event_to)
        
        # Calcola i cambiamenti di valore usando la logica unificata
        changes = []
        last_value = current_value
        last_source = current_source
        
        for event_time in sorted(event_times):
            # Usa la logica unificata per calcolare tutte le configurazioni a questo momento
            # NOTA PERFORMANCE: Questo calcola TUTTE le configurazioni esistenti, anche se
            # alla fine interessa solo il valore di 'setup_name'. Tuttavia, le dipendenze
            # condizionali rendono spesso necessario calcolare tutto.
            # OTTIMIZZAZIONE FUTURA: Aggiungere parametro target_setup_names per limitare il calcolo
            all_configs_at_time = self._get_configurations_at_time(event_time)
            
            # Estrai il valore per il setup specifico
            if setup_name in all_configs_at_time:
                config_at_time = all_configs_at_time[setup_name]
                new_value = config_at_time['value']
                new_source = config_at_time['source']
                
                # Aggiungi solo se il valore cambia effettivamente
                if new_value != last_value:
                    minutes_until = int((event_time - now).total_seconds() / 60)
                    
                    changes.append({
                        'value': new_value,
                        'minutes_until': minutes_until,
                        'timestamp': event_time.isoformat(),
                        'type': new_source  # Il tipo è la sorgente che ha vinto (time, schedule, conditional, standard)
                    })
                    
                    last_value = new_value
                    last_source = new_source
        
        # Salva in cache prima di restituire
        result = changes[:max_results]
        self._next_changes_cache[cache_key] = {
            'value': current_value,
            'config_version': self._config_version,
            'result': result,
            'timestamp': now.isoformat()
        }
        
        return result
    
    def cleanup_expired_events(self, days: int = 30) -> int:
        """
        Rimuove gli eventi a tempo scaduti da più di X giorni.
        Returns: numero di righe eliminate.
        """
        cursor = self.conn.cursor()
        cutoff_date = datetime.now() - timedelta(days=days)
        
        cursor.execute("""
            DELETE FROM configurazioni_a_tempo
            WHERE datetime(valid_to_date) < datetime(?)
        """, (cutoff_date.isoformat(),))
        
        deleted_count = cursor.rowcount
        self.conn.commit()
        
        return deleted_count
    
    # ========== Gestione Valori Validi ==========
    
    def get_valid_values(self, setup_name: str) -> List[Dict[str, Any]]:
        """Ottiene la lista dei valori validi per una configurazione."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, value, description, sort_order
            FROM configurazioni_valori_validi
            WHERE setup_name = ?
            ORDER BY sort_order, value
        """, (setup_name,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def add_valid_value(self, setup_name: str, value: str, description: str = None, sort_order: int = 0) -> None:
        """Aggiunge un valore valido per una configurazione."""
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO configurazioni_valori_validi (setup_name, value, description, sort_order)
                VALUES (?, ?, ?, ?)
            """, (setup_name, value, description, sort_order))
            self.conn.commit()
            _LOGGER.info(f"Valore valido aggiunto: {setup_name} = {value}")
        except sqlite3.IntegrityError:
            # Valore già esiste, aggiorna descrizione
            cursor.execute("""
                UPDATE configurazioni_valori_validi
                SET description = ?, sort_order = ?
                WHERE setup_name = ? AND value = ?
            """, (description, sort_order, setup_name, value))
            self.conn.commit()
            _LOGGER.info(f"Valore valido aggiornato: {setup_name} = {value}")
    
    def delete_valid_value(self, valid_value_id: int) -> None:
        """Elimina un valore valido."""
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM configurazioni_valori_validi WHERE id = ?", (valid_value_id,))
        self.conn.commit()
        _LOGGER.info(f"Valore valido eliminato: ID {valid_value_id}")
    
    def cleanup_orphan_valid_values(self) -> int:
        """
        Rimuove i valori validi per configurazioni che non esistono più.
        Returns: numero di righe eliminate.
        """
        cursor = self.conn.cursor()
        
        # Trova tutti i setup_name ancora in uso
        cursor.execute("""
            SELECT DISTINCT setup_name FROM configurazioni
            UNION
            SELECT DISTINCT setup_name FROM configurazioni_a_orario
            UNION
            SELECT DISTINCT setup_name FROM configurazioni_a_tempo
        """)
        
        active_names = {row['setup_name'] for row in cursor.fetchall()}
        
        if not active_names:
            # Nessuna configurazione, elimina tutti i valori validi
            cursor.execute("DELETE FROM configurazioni_valori_validi")
        else:
            # Elimina solo valori per setup_name non più presenti
            placeholders = ','.join('?' * len(active_names))
            cursor.execute(f"""
                DELETE FROM configurazioni_valori_validi
                WHERE setup_name NOT IN ({placeholders})
            """, tuple(active_names))
        
        deleted_count = cursor.rowcount
        self.conn.commit()
        
        if deleted_count > 0:
            _LOGGER.info(f"Rimossi {deleted_count} valori validi orfani")
        
        return deleted_count
    
    def simulate_configuration_schedule(
        self,
        setup_name: str,
        start_date: datetime,
        days: int = 14,
        granularity_minutes: int = 1
    ) -> List[Dict[str, Any]]:
        """Simula la configurazione per un periodo di tempo specificato.
        USA LA LOGICA UNIFICATA _get_configurations_at_time per garantire coerenza con il runtime.
        
        Args:
            setup_name: Nome della configurazione da simulare
            start_date: Data di inizio simulazione
            days: Numero di giorni da simulare (default 14)
            granularity_minutes: Granularità campionamento in minuti (allineato a scan_interval componente)
                                 Derivato automaticamente da scan_interval (60s → 1min, 300s → 5min, etc.)
                                 Una granularità maggiore migliora le performance (meno query database)
        
        Returns:
            Lista di segmenti, ognuno con:
            - date: Data del giorno (YYYY-MM-DD)
            - day_of_week: Giorno della settimana (0=Lun, 6=Dom)
            - start_minute: Minuto di inizio (0-1439)
            - end_minute: Minuto di fine (0-1440, esclusivo)
            - value: Valore della configurazione
            - type: Tipo (standard, schedule, time, conditional)
            - priority: Priorità
            - metadata: Dati aggiuntivi specifici per tipo
        """
        segments = []
        cursor = self.conn.cursor()

        # Pre-carica i metadata per tipo - necessari per il frontend
        cursor.execute("SELECT * FROM configurazioni_a_orario WHERE setup_name = ?", (setup_name,))
        schedule_configs = {row['id']: dict(row) for row in cursor.fetchall()}
        
        cursor.execute("SELECT * FROM configurazioni_a_tempo WHERE setup_name = ?", (setup_name,))
        time_configs = {row['id']: dict(row) for row in cursor.fetchall()}
        
        cursor.execute("SELECT * FROM configurazioni_condizionali WHERE setup_name = ?", (setup_name,))
        conditional_configs = {row['id']: dict(row) for row in cursor.fetchall()}

        # Simula giorno per giorno
        for day_offset in range(days):
            current_date = start_date + timedelta(days=day_offset)
            day_of_week = current_date.weekday()
            date_str = current_date.strftime('%Y-%m-%d')
            
            # Costruisci mappa minuti usando la logica unificata con granularità configurabile
            minute_map = [None] * 1440
            
            # Campiona ogni N minuti secondo la granularità specificata
            # Per riempire i minuti intermedi, copia il valore campionato
            for sample_minute in range(0, 1440, granularity_minutes):
                hour = sample_minute // 60
                min_part = sample_minute % 60
                timestamp = current_date.replace(hour=hour, minute=min_part, second=0, microsecond=0)
                
                # Usa la logica unificata
                # NOTA PERFORMANCE: Anche qui calcola TUTTE le configurazioni esistenti
                # per ogni timestamp campionato, necessario per dipendenze condizionali
                all_configs = self._get_configurations_at_time(timestamp)
                
                # Trova la configurazione per questo setup_name
                sample_config = None
                if setup_name in all_configs:
                    config = all_configs[setup_name]
                    sample_config = {
                        'value': config['value'],
                        'source': config['source'],
                        'priority': config['priority'],
                        'id': config['id']
                    }
                
                # Riempie i minuti dal sample corrente fino al prossimo sample (o fine giorno)
                end_minute = min(sample_minute + granularity_minutes, 1440)
                for minute in range(sample_minute, end_minute):
                    minute_map[minute] = sample_config
            
            # Converti la mappa in segmenti
            current_segment = None
            for minute in range(1440):
                config = minute_map[minute]
                
                if not config:
                    if current_segment:
                        segments.append(current_segment)
                        current_segment = None
                    continue
                
                # Stesso segmento?
                if current_segment and \
                   current_segment['value'] == config['value'] and \
                   current_segment['type'] == config['source'] and \
                   current_segment['priority'] == config['priority']:
                    current_segment['end_minute'] = minute + 1
                else:
                    if current_segment:
                        segments.append(current_segment)
                    
                    current_segment = {
                        'date': date_str,
                        'day_of_week': day_of_week,
                        'start_minute': minute,
                        'end_minute': minute + 1,
                        'value': config['value'],
                        'type': config['source'],  # mapping: source → type per compatibilità API
                        'priority': config['priority'],
                        'id': config['id']
                    }
                    
                    # Aggiungi metadata specifici per tipo (necessari per tooltip frontend)
                    config_id = config['id']
                    if config['source'] == 'schedule' and config_id in schedule_configs:
                        sched = schedule_configs[config_id]
                        current_segment['metadata'] = {
                            'valid_from_ora': sched['valid_from_ora'],
                            'valid_to_ora': sched['valid_to_ora'],
                            'days_of_week': [int(d) for d in sched['days_of_week'].split(',') if d] if sched['days_of_week'] else [0,1,2,3,4,5,6]
                        }
                    elif config['source'] == 'time' and config_id in time_configs:
                        time_cfg = time_configs[config_id]
                        current_segment['metadata'] = {
                            'valid_from_date': time_cfg['valid_from_date'],
                            'valid_to_date': time_cfg['valid_to_date']
                        }
                    elif config['source'] == 'conditional' and config_id in conditional_configs:
                        cond = conditional_configs[config_id]
                        current_segment['metadata'] = {
                            'conditional_config': cond['conditional_config'],
                            'conditional_operator': cond['conditional_operator'],
                            'conditional_value': cond['conditional_value']
                        }
                        # Aggiungi fascia oraria se presente
                        if cond['valid_from_ora'] is not None and cond['valid_to_ora'] is not None:
                            current_segment['metadata']['valid_from_ora'] = cond['valid_from_ora']
                            current_segment['metadata']['valid_to_ora'] = cond['valid_to_ora']
            
            # Aggiungi l'ultimo segmento del giorno
            if current_segment:
                segments.append(current_segment)
        
        return segments
    
    def close(self) -> None:
        """Chiude la connessione al database."""
        if self.conn:
            self.conn.close()
            _LOGGER.info("Database chiuso")
