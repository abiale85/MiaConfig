"""Database manager per Dynamic Config."""
import sqlite3
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

_LOGGER = logging.getLogger(__name__)


class ConfigDatabase:
    """Gestisce il database SQLite per le configurazioni dinamiche."""
    
    def __init__(self, db_path: str):
        """Inizializza il database manager."""
        self.db_path = db_path
        self.conn = None
    
    def initialize(self) -> None:
        """Crea le tabelle se non esistono."""
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        
        cursor = self.conn.cursor()
        
        # Tabella configurazioni standard
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS configurazioni (
                setup_name TEXT PRIMARY KEY NOT NULL,
                setup_value TEXT,
                priority INTEGER NOT NULL DEFAULT 99
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
                days_of_week TEXT DEFAULT '0,1,2,3,4,5,6'
            )
        """)
        
        # Tabella configurazioni a tempo
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS configurazioni_a_tempo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setup_name TEXT NOT NULL,
                setup_value TEXT,
                valid_from_date DATETIME NOT NULL,
                valid_to_date DATETIME
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
        
        self.conn.commit()
        _LOGGER.info("Database inizializzato: %s", self.db_path)
    
    def get_all_configurations(self) -> Dict[str, Any]:
        """
        Ottiene tutte le configurazioni applicando la logica di priorità.
        Priorità: tempo > orario > standard
        """
        cursor = self.conn.cursor()
        
        # Setup a tempo (massima priorità)
        # Ordina per ID DESC per ottenere l'ultimo inserito
        cursor.execute("""
            SELECT setup_name, setup_value, valid_to_date as source, id
            FROM configurazioni_a_tempo
            WHERE datetime('now', 'localtime') BETWEEN valid_from_date AND valid_to_date
            ORDER BY id DESC
        """)
        setup_a_tempo = {}
        for row in cursor.fetchall():
            # Prendi solo la prima (ultima inserita) per ogni setup_name
            if row['setup_name'] not in setup_a_tempo:
                setup_a_tempo[row['setup_name']] = {
                    'value': row['setup_value'],
                    'source': 'time',
                    'valid_to': row['source']
                }
        
        # Setup a orario (priorità media)
        # Ottieni il giorno corrente (0=Lunedì, 6=Domenica in Python weekday)
        # Nel DB: 0=Lun, 1=Mar, 2=Mer, 3=Gio, 4=Ven, 5=Sab, 6=Dom
        current_day = datetime.now().weekday()  # Python: 0=Lun, 6=Dom - CORRETTO!
        current_time = float(datetime.now().strftime('%H.%M'))
        
        cursor.execute("""
            SELECT setup_name, setup_value, valid_to_ora as source, days_of_week, id, valid_from_ora, valid_to_ora
            FROM configurazioni_a_orario
            ORDER BY id DESC
        """)
        setup_a_ora = {}
        for row in cursor.fetchall():
            # Verifica se il giorno corrente è nei giorni validi
            days_of_week = row['days_of_week'] if row['days_of_week'] else '0,1,2,3,4,5,6'
            valid_days = [int(d) for d in days_of_week.split(',')]
            
            valid_from = row['valid_from_ora']
            valid_to = row['valid_to_ora']
            
            # Gestisce orari a cavallo di mezzanotte (es. 22.00 - 2.00)
            is_valid = False
            if valid_to < valid_from:  # Attraversa la mezzanotte
                # Valido se l'ora corrente è >= inizio O <= fine
                is_valid = (current_time >= valid_from or current_time <= valid_to)
            else:  # Normale fascia oraria
                is_valid = (valid_from <= current_time <= valid_to)
            
            # Prendi solo la prima (ultima inserita) per ogni setup_name
            if is_valid and current_day in valid_days and row['setup_name'] not in setup_a_tempo and row['setup_name'] not in setup_a_ora:
                setup_a_ora[row['setup_name']] = {
                    'value': row['setup_value'],
                    'source': 'schedule',
                    'valid_to': row['source'],
                    'days_of_week': valid_days
                }
        
        # Setup standard (priorità bassa)
        cursor.execute("""
            SELECT setup_name, setup_value, priority
            FROM configurazioni
            ORDER BY priority
        """)
        setup_standard = {}
        for row in cursor.fetchall():
            if row['setup_name'] not in setup_a_tempo and row['setup_name'] not in setup_a_ora:
                setup_standard[row['setup_name']] = {
                    'value': row['setup_value'],
                    'source': 'standard',
                    'priority': row['priority']
                }
        
        # Unisci tutti i setup
        result = {}
        result.update(setup_standard)
        result.update(setup_a_ora)
        result.update(setup_a_tempo)
        
        return result
    
    def get_configuration(self, setup_name: str) -> Optional[Dict[str, Any]]:
        """Ottiene una specifica configurazione applicando la logica di priorità."""
        all_configs = self.get_all_configurations()
        return all_configs.get(setup_name)
    
    def set_config(self, setup_name: str, setup_value: str, priority: int = 99) -> None:
        """Imposta una configurazione standard."""
        cursor = self.conn.cursor()
        
        # Controlla se esiste già
        cursor.execute("SELECT * FROM configurazioni WHERE setup_name = ?", (setup_name,))
        existing = cursor.fetchone()
        
        # Salva nello storico
        if existing:
            self._save_to_history(
                setup_name, 'standard',
                {'setup_value': existing['setup_value'], 'priority': existing['priority']},
                'UPDATE'
            )
        
        cursor.execute("""
            INSERT OR REPLACE INTO configurazioni (setup_name, setup_value, priority)
            VALUES (?, ?, ?)
        """, (setup_name, setup_value, priority))
        
        # Salva la nuova versione nello storico
        self._save_to_history(
            setup_name, 'standard',
            {'setup_value': setup_value, 'priority': priority},
            'INSERT' if not existing else 'UPDATE'
        )
        
        self.conn.commit()
        _LOGGER.debug(f"Set config: {setup_name} = {setup_value} (priority: {priority})")
    
    def set_time_config(
        self, 
        setup_name: str, 
        setup_value: str, 
        valid_from: datetime, 
        valid_to: datetime
    ) -> None:
        """Imposta una configurazione a tempo."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO configurazioni_a_tempo 
            (setup_name, setup_value, valid_from_date, valid_to_date)
            VALUES (?, ?, ?, ?)
        """, (setup_name, setup_value, valid_from, valid_to))
        
        # Salva nello storico
        self._save_to_history(
            setup_name, 'time',
            {
                'setup_value': setup_value,
                'valid_from_date': str(valid_from),
                'valid_to_date': str(valid_to)
            },
            'INSERT'
        )
        
        self.conn.commit()
        _LOGGER.debug(f"Set time config: {setup_name} = {setup_value} ({valid_from} - {valid_to})")
    
    def set_schedule_config(
        self, 
        setup_name: str, 
        setup_value: str, 
        valid_from_ora: float, 
        valid_to_ora: float,
        days_of_week: str = '0,1,2,3,4,5,6'
    ) -> None:
        """Imposta una configurazione a orario."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO configurazioni_a_orario 
            (setup_name, setup_value, valid_from_ora, valid_to_ora, days_of_week)
            VALUES (?, ?, ?, ?, ?)
        """, (setup_name, setup_value, valid_from_ora, valid_to_ora, days_of_week))
        
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
        
        self.conn.commit()
        _LOGGER.debug(f"Deleted config: {setup_name} (type: {config_type})")
    
    def get_all_setup_names(self) -> List[str]:
        """Ottiene tutti i nomi delle configurazioni esistenti."""
        cursor = self.conn.cursor()
        
        names = set()
        
        cursor.execute("SELECT DISTINCT setup_name FROM configurazioni")
        names.update(row['setup_name'] for row in cursor.fetchall())
        
        cursor.execute("SELECT DISTINCT setup_name FROM configurazioni_a_orario")
        names.update(row['setup_name'] for row in cursor.fetchall())
        
        cursor.execute("SELECT DISTINCT setup_name FROM configurazioni_a_tempo")
        names.update(row['setup_name'] for row in cursor.fetchall())
        
        return sorted(list(names))
    
    def get_all_configurations_detailed(self) -> Dict[str, List[Dict[str, Any]]]:
        """Ottiene tutte le configurazioni con tutti i dettagli, raggruppate per nome."""
        cursor = self.conn.cursor()
        result = {}
        
        # Configurazioni standard
        cursor.execute("SELECT * FROM configurazioni ORDER BY setup_name, priority")
        for row in cursor.fetchall():
            name = row['setup_name']
            if name not in result:
                result[name] = []
            result[name].append({
                'type': 'standard',
                'value': row['setup_value'],
                'priority': row['priority']
            })
        
        # Configurazioni a orario
        cursor.execute("SELECT * FROM configurazioni_a_orario ORDER BY setup_name")
        for row in cursor.fetchall():
            name = row['setup_name']
            if name not in result:
                result[name] = []
            result[name].append({
                'type': 'schedule',
                'id': row['id'],
                'value': row['setup_value'],
                'valid_from_ora': row['valid_from_ora'],
                'valid_to_ora': row['valid_to_ora'],
                'days_of_week': [int(d) for d in row['days_of_week'].split(',')]
            })
        
        # Configurazioni a tempo
        cursor.execute("SELECT * FROM configurazioni_a_tempo ORDER BY setup_name")
        for row in cursor.fetchall():
            name = row['setup_name']
            if name not in result:
                result[name] = []
            result[name].append({
                'type': 'time',
                'id': row['id'],
                'value': row['setup_value'],
                'valid_from_date': row['valid_from_date'],
                'valid_to_date': row['valid_to_date']
            })
        
        return result
    
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
    
    def delete_single_config(self, config_type: str, config_id: int) -> None:
        """Elimina una singola configurazione per ID."""
        cursor = self.conn.cursor()
        
        # Salva nello storico prima di eliminare
        if config_type == 'schedule':
            cursor.execute("SELECT * FROM configurazioni_a_orario WHERE id = ?", (config_id,))
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
            cursor.execute("DELETE FROM configurazioni_a_orario WHERE id = ?", (config_id,))
        elif config_type == 'time':
            cursor.execute("SELECT * FROM configurazioni_a_tempo WHERE id = ?", (config_id,))
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
            cursor.execute("DELETE FROM configurazioni_a_tempo WHERE id = ?", (config_id,))
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
    
    def get_history(self, setup_name: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Ottiene lo storico delle configurazioni."""
        cursor = self.conn.cursor()
        
        if setup_name:
            cursor.execute("""
                SELECT * FROM configurazioni_storico 
                WHERE setup_name = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (setup_name, limit))
        else:
            cursor.execute("""
                SELECT * FROM configurazioni_storico 
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
        
        return [dict(row) for row in cursor.fetchall()]
    
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
    
    def close(self) -> None:
        """Chiude la connessione al database."""
        if self.conn:
            self.conn.close()
            _LOGGER.info("Database chiuso")
