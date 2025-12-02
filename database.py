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
    
    def initialize(self) -> None:
        """Crea le tabelle se non esistono e applica migrazioni."""
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        
        cursor = self.conn.cursor()
        
        # Tabella configurazioni standard
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS configurazioni (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setup_name TEXT NOT NULL,
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
                days_of_week TEXT DEFAULT '0,1,2,3,4,5,6',
                priority INTEGER NOT NULL DEFAULT 99
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
                priority INTEGER NOT NULL DEFAULT 99
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
        
        self.conn.commit()
        _LOGGER.info("Database inizializzato: %s", self.db_path)
    
    def get_all_configurations(self) -> Dict[str, Any]:
        """
        Ottiene tutte le configurazioni applicando la logica di priorità globale.
        
        Logica:
        1. Prima ordina per priorità (1 = massima, 99 = minima)
        2. A parità di priorità: tempo > orario > standard
        """
        cursor = self.conn.cursor()
        
        # Carica tutte le descrizioni in memoria
        cursor.execute("SELECT setup_name, description FROM configurazioni_descrizioni")
        descriptions = {row['setup_name']: row['description'] for row in cursor.fetchall()}
        
        # Raccogli tutte le configurazioni attive
        all_active_configs = []
        
        # Configurazioni a tempo attive
        current_day = datetime.now().weekday()
        current_time = float(datetime.now().strftime('%H.%M'))
        
        cursor.execute("""
            SELECT setup_name, setup_value, priority, 'time' as source_type, 
                   valid_to_date, valid_from_ora, valid_to_ora, days_of_week, id
            FROM configurazioni_a_tempo
            WHERE datetime('now', 'localtime') BETWEEN valid_from_date AND valid_to_date
        """)
        for row in cursor.fetchall():
            # Verifica filtri opzionali orari
            if row['valid_from_ora'] is not None and row['valid_to_ora'] is not None:
                valid_from = row['valid_from_ora']
                valid_to = row['valid_to_ora']
                
                is_valid_time = False
                if valid_to < valid_from:  # Attraversa la mezzanotte
                    is_valid_time = (current_time >= valid_from or current_time <= valid_to)
                else:
                    is_valid_time = (valid_from <= current_time <= valid_to)
                
                if not is_valid_time:
                    continue
            
            # Verifica filtri opzionali giorni
            if row['days_of_week'] is not None:
                valid_days = [int(d) for d in row['days_of_week'].split(',')]
                if current_day not in valid_days:
                    continue
            
            all_active_configs.append({
                'setup_name': row['setup_name'],
                'value': row['setup_value'],
                'priority': row['priority'],
                'source': 'time',
                'source_order': 1,  # tempo ha precedenza a parità di priorità
                'valid_to': row['valid_to_date'],
                'id': row['id']
            })
        
        # Configurazioni a orario attive
        current_day = datetime.now().weekday()
        current_time = float(datetime.now().strftime('%H.%M'))
        
        cursor.execute("""
            SELECT setup_name, setup_value, priority, valid_from_ora, valid_to_ora, 
                   days_of_week, id
            FROM configurazioni_a_orario
        """)
        for row in cursor.fetchall():
            days_of_week = row['days_of_week'] if row['days_of_week'] else '0,1,2,3,4,5,6'
            valid_days = [int(d) for d in days_of_week.split(',')]
            
            valid_from = row['valid_from_ora']
            valid_to = row['valid_to_ora']
            
            # Verifica validità oraria
            is_valid = False
            if valid_to < valid_from:  # Attraversa la mezzanotte
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
                    'source_order': 2,  # orario ha precedenza su standard
                    'valid_to': valid_to,
                    'days_of_week': valid_days,
                    'id': row['id']
                })
        
        # Configurazioni standard (sempre attive)
        cursor.execute("""
            SELECT setup_name, setup_value, priority, id
            FROM configurazioni
        """)
        for row in cursor.fetchall():
            all_active_configs.append({
                'setup_name': row['setup_name'],
                'value': row['setup_value'],
                'priority': row['priority'],
                'source': 'standard',
                'source_order': 3,  # standard ha priorità minore
                'id': row['id']
            })
        
        # Ordina per priorità (crescente) e poi per source_order (crescente)
        # Priorità 1 = massima priorità
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
                    'description': descriptions.get(name)
                }
                # Aggiungi campi specifici per tipo
                if 'valid_to' in config:
                    result[name]['valid_to'] = config['valid_to']
                if 'days_of_week' in config:
                    result[name]['days_of_week'] = config['days_of_week']
        
        return result
    
    def get_configuration(self, setup_name: str) -> Optional[Dict[str, Any]]:
        """Ottiene una specifica configurazione applicando la logica di priorità."""
        all_configs = self.get_all_configurations()
        return all_configs.get(setup_name)
    
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
        
        # Salva nello storico
        self._save_to_history(
            setup_name, 'standard',
            {'setup_value': setup_value, 'priority': priority},
            'INSERT'
        )
        
        self.conn.commit()
        _LOGGER.debug(f"Set config: {setup_name} = {setup_value} (priority: {priority})")
    
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
        
        # Salva nello storico
        self._save_to_history(
            setup_name, 'standard',
            {'setup_value': setup_value, 'priority': priority},
            'UPDATE'
        )
        
        self.conn.commit()
        _LOGGER.debug(f"Updated config id {config_id}: {setup_name} = {setup_value} (priority: {priority})")
    
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
        
        # Configurazioni standard (con descrizione)
        cursor.execute("""
            SELECT c.*, d.description 
            FROM configurazioni c
            LEFT JOIN configurazioni_descrizioni d ON c.setup_name = d.setup_name
            ORDER BY c.setup_name, c.priority
        """)
        for row in cursor.fetchall():
            name = row['setup_name']
            if name not in result:
                result[name] = []
            config_dict = {
                'type': 'standard',
                'id': row['id'],
                'value': row['setup_value'],
                'priority': row['priority']
            }
            # Aggiungi descrizione solo se presente
            if row['description']:
                config_dict['description'] = row['description']
            result[name].append(config_dict)
        
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
                'days_of_week': [int(d) for d in row['days_of_week'].split(',')],
                'priority': row['priority']
            })
        
        # Configurazioni a tempo
        cursor.execute("SELECT * FROM configurazioni_a_tempo ORDER BY setup_name")
        for row in cursor.fetchall():
            name = row['setup_name']
            if name not in result:
                result[name] = []
            config_dict = {
                'type': 'time',
                'id': row['id'],
                'value': row['setup_value'],
                'valid_from_date': row['valid_from_date'],
                'valid_to_date': row['valid_to_date'],
                'priority': row['priority']
            }
            # Aggiungi filtri opzionali se presenti
            if row['valid_from_ora'] is not None:
                config_dict['valid_from_ora'] = row['valid_from_ora']
            if row['valid_to_ora'] is not None:
                config_dict['valid_to_ora'] = row['valid_to_ora']
            if row['days_of_week'] is not None:
                config_dict['days_of_week'] = [int(d) for d in row['days_of_week'].split(',')]
            
            result[name].append(config_dict)
        
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
    
    def get_next_changes(self, setup_name: str, limit_hours: int = 24) -> List[Dict[str, Any]]:
        """
        Calcola i prossimi cambiamenti di valore per una configurazione.
        Include eventi di INIZIO (time/schedule) e FINE (ritorno al default).
        Restituisce una lista di eventi futuri nelle prossime limit_hours ore.
        """
        cursor = self.conn.cursor()
        now = datetime.now()
        
        # Ottieni il valore default (standard config)
        cursor.execute("""
            SELECT setup_value
            FROM configurazioni
            WHERE setup_name = ?
        """, (setup_name,))
        default_row = cursor.fetchone()
        default_value = default_row['setup_value'] if default_row else None
        
        events = []
        
        # Eventi da configurazioni a tempo
        cursor.execute("""
            SELECT setup_value, valid_from_date, valid_to_date
            FROM configurazioni_a_tempo
            WHERE setup_name = ? AND datetime(valid_from_date) > datetime('now', 'localtime')
            AND datetime(valid_from_date) <= datetime('now', 'localtime', '+' || ? || ' hours')
            ORDER BY valid_from_date
        """, (setup_name, limit_hours))
        
        for row in cursor.fetchall():
            valid_from = datetime.fromisoformat(row['valid_from_date'])
            valid_to = datetime.fromisoformat(row['valid_to_date']) if row['valid_to_date'] else None
            minutes_until = int((valid_from - now).total_seconds() / 60)
            
            # Evento INIZIO config a tempo
            events.append({
                'value': row['setup_value'],
                'minutes_until': minutes_until,
                'type': 'time'
            })
            
            # Evento FINE config a tempo (ritorno al default)
            if valid_to and default_value:
                minutes_until_end = int((valid_to - now).total_seconds() / 60)
                if minutes_until_end <= limit_hours * 60:
                    events.append({
                        'value': default_value,
                        'minutes_until': minutes_until_end,
                        'type': 'time_end'
                    })
        
        # Eventi da configurazioni a orario (prossime 24 ore)
        cursor.execute("""
            SELECT setup_value, valid_from_ora, valid_to_ora, days_of_week
            FROM configurazioni_a_orario
            WHERE setup_name = ?
        """, (setup_name,))
        
        for row in cursor.fetchall():
            days_list = [int(d) for d in row['days_of_week'].split(',')]
            valid_from_decimal = row['valid_from_ora']
            valid_to_decimal = row['valid_to_ora']
            
            # Controlla oggi e domani
            for day_offset in range(2):
                check_date = now + timedelta(days=day_offset)
                weekday = check_date.weekday()  # 0=Monday
                
                if weekday in days_list:
                    # Evento INIZIO
                    from_hour = int(valid_from_decimal)
                    from_min = int((valid_from_decimal - from_hour) * 60)
                    event_time = check_date.replace(hour=from_hour, minute=from_min, second=0, microsecond=0)
                    
                    if event_time > now and (event_time - now).total_seconds() <= limit_hours * 3600:
                        minutes_until = int((event_time - now).total_seconds() / 60)
                        events.append({
                            'value': row['setup_value'],
                            'minutes_until': minutes_until,
                            'type': 'schedule'
                        })
                    
                    # Evento FINE (ritorno al default)
                    if valid_to_decimal and default_value:
                        to_hour = int(valid_to_decimal)
                        to_min = int((valid_to_decimal - to_hour) * 60)
                        
                        # Gestisce attraversamento mezzanotte
                        if valid_to_decimal < valid_from_decimal:
                            # Fine è il giorno dopo
                            end_time = (check_date + timedelta(days=1)).replace(hour=to_hour, minute=to_min, second=0, microsecond=0)
                        else:
                            end_time = check_date.replace(hour=to_hour, minute=to_min, second=0, microsecond=0)
                        
                        if end_time > now and (end_time - now).total_seconds() <= limit_hours * 3600:
                            minutes_until_end = int((end_time - now).total_seconds() / 60)
                            events.append({
                                'value': default_value,
                                'minutes_until': minutes_until_end,
                                'type': 'schedule_end'
                            })
        
        # Ordina per tempo
        events.sort(key=lambda x: x['minutes_until'])
        
        return events[:5]  # Max 5 eventi
    
    def get_current_config_start_time(self, setup_name: str) -> Optional[int]:
        """
        Calcola da quanti minuti è attivo il valore corrente per una configurazione.
        Limita la ricerca alle ultime 24 ore per evitare valori enormi.
        Restituisce i minuti dall'inizio della configurazione attiva, o None se non determinabile.
        """
        cursor = self.conn.cursor()
        now = datetime.now()
        current_day = now.weekday()
        current_time = float(now.strftime('%H.%M'))
        
        # Limita la ricerca a 24 ore nel passato
        lookback_limit = now - timedelta(hours=24)
        
        # Controlla se c'è una configurazione a tempo attiva
        cursor.execute("""
            SELECT valid_from_date, valid_to_date
            FROM configurazioni_a_tempo
            WHERE setup_name = ?
            AND datetime('now', 'localtime') BETWEEN valid_from_date AND valid_to_date
            AND datetime(valid_from_date) >= datetime(?)
            ORDER BY id DESC
            LIMIT 1
        """, (setup_name, lookback_limit.isoformat()))
        
        time_config = cursor.fetchone()
        if time_config:
            valid_from = datetime.fromisoformat(time_config['valid_from_date'])
            minutes_active = int((now - valid_from).total_seconds() / 60)
            return max(0, minutes_active)
        
        # Controlla se c'è una configurazione a orario attiva
        cursor.execute("""
            SELECT valid_from_ora, valid_to_ora, days_of_week
            FROM configurazioni_a_orario
            WHERE setup_name = ?
            ORDER BY id DESC
        """, (setup_name,))
        
        for row in cursor.fetchall():
            days_of_week = row['days_of_week'] if row['days_of_week'] else '0,1,2,3,4,5,6'
            valid_days = [int(d) for d in days_of_week.split(',')]
            
            valid_from = row['valid_from_ora']
            valid_to = row['valid_to_ora']
            
            # Verifica se è attiva ora
            is_valid = False
            if valid_to < valid_from:  # Attraversa la mezzanotte
                is_valid = (current_time >= valid_from or current_time <= valid_to)
            else:
                is_valid = (valid_from <= current_time <= valid_to)
            
            if is_valid and current_day in valid_days:
                # Calcola da quanto è attiva
                from_hour = int(valid_from)
                from_min = int((valid_from - from_hour) * 60)
                
                # Se attraversa mezzanotte e siamo dopo mezzanotte
                if valid_to < valid_from and current_time <= valid_to:
                    # È iniziata ieri
                    start_time = (now - timedelta(days=1)).replace(hour=from_hour, minute=from_min, second=0, microsecond=0)
                else:
                    # È iniziata oggi
                    start_time = now.replace(hour=from_hour, minute=from_min, second=0, microsecond=0)
                
                # Limita a 24 ore
                if start_time >= lookback_limit:
                    minutes_active = int((now - start_time).total_seconds() / 60)
                    return max(0, minutes_active)
                else:
                    # Troppo vecchio, ritorna il massimo (24 ore = 1440 minuti)
                    return 1440
        
        # Se è una configurazione standard, restituisce None (sempre attiva)
        return None
    
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
        
        if deleted_count > 0:
            _LOGGER.info(f"Cleanup: eliminati {deleted_count} eventi a tempo scaduti da più di {days} giorni")
        
        return deleted_count
    
    def close(self) -> None:
        """Chiude la connessione al database."""
        if self.conn:
            self.conn.close()
            _LOGGER.info("Database chiuso")
