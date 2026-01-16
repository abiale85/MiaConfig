"""Config flow per Mia Config."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import FlowResult
import homeassistant.helpers.config_validation as cv

from .const import (
    DOMAIN,
    DEFAULT_NAME,
    DEFAULT_LOOKAHEAD_HOURS,
    DEFAULT_LOOKBACK_HOURS,
    DEFAULT_CLEANUP_DAYS,
    DEFAULT_HISTORY_RETENTION_DAYS,
    DEFAULT_MAX_HISTORY_PER_NAME,
    DEFAULT_MIN_HISTORY_PER_NAME,
)

_LOGGER = logging.getLogger(__name__)

STEP_USER_DATA_SCHEMA = vol.Schema({
    vol.Optional("db_name", default="mia_config"): cv.string,
    vol.Optional("lookahead_hours", default=DEFAULT_LOOKAHEAD_HOURS): cv.positive_int,
    vol.Optional("lookback_hours", default=DEFAULT_LOOKBACK_HOURS): cv.positive_int,
    vol.Optional("cleanup_days", default=DEFAULT_CLEANUP_DAYS): cv.positive_int,
    vol.Optional("retention_days", default=DEFAULT_HISTORY_RETENTION_DAYS): cv.positive_int,
    vol.Optional("max_history_per_name", default=DEFAULT_MAX_HISTORY_PER_NAME): cv.positive_int,
    vol.Optional("min_history_per_name", default=DEFAULT_MIN_HISTORY_PER_NAME): cv.positive_int,
})


class MiaConfigFlowHandler(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Mia Config."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        if user_input is not None:
            # Usa db_name come unique_id per permettere multiple istanze
            db_name = user_input.get("db_name", "mia_config")
            await self.async_set_unique_id(db_name)
            self._abort_if_unique_id_configured()

            # Separa db_name (va in data) dalle altre opzioni
            options = {k: v for k, v in user_input.items() if k != "db_name"}

            return self.async_create_entry(
                title=f"{DEFAULT_NAME} ({db_name})",
                data={"db_name": db_name},
                options=options,
            )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_DATA_SCHEMA,
            description_placeholders={
                "name": DEFAULT_NAME,
            },
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> MiaConfigOptionsFlowHandler:
        """Get the options flow for this handler."""
        return MiaConfigOptionsFlowHandler(config_entry)


class MiaConfigOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for Mia Config."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Optional(
                    "lookahead_hours",
                    default=self.config_entry.options.get(
                        "lookahead_hours", DEFAULT_LOOKAHEAD_HOURS
                    ),
                ): cv.positive_int,
                vol.Optional(
                    "lookback_hours",
                    default=self.config_entry.options.get(
                        "lookback_hours", DEFAULT_LOOKBACK_HOURS
                    ),
                ): cv.positive_int,
                vol.Optional(
                    "cleanup_days",
                    default=self.config_entry.options.get(
                        "cleanup_days", DEFAULT_CLEANUP_DAYS
                    ),
                ): cv.positive_int,
                vol.Optional(
                    "retention_days",
                    default=self.config_entry.options.get(
                        "retention_days", DEFAULT_HISTORY_RETENTION_DAYS
                    ),
                ): cv.positive_int,
                vol.Optional(
                    "max_history_per_name",
                    default=self.config_entry.options.get(
                        "max_history_per_name", DEFAULT_MAX_HISTORY_PER_NAME
                    ),
                ): cv.positive_int,
                vol.Optional(
                    "min_history_per_name",
                    default=self.config_entry.options.get(
                        "min_history_per_name", DEFAULT_MIN_HISTORY_PER_NAME
                    ),
                ): cv.positive_int,
            }),
        )
