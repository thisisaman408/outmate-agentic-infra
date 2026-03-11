from textwrap import dedent

from lfx.custom.validate import create_class


def test_importing_outmate_module_in_lfx():
    code = dedent("""from outmate.custom import   Component
class TestComponent(Component):
    def some_method(self):
        pass
    """)
    result = create_class(code, "TestComponent")
    assert result.__name__ == "TestComponent"


def test_importing_outmate_logging_in_lfx():
    """Test that outmate.logging can be imported in lfx context without errors."""
    code = dedent("""
from outmate.logging import logger, configure
from outmate.custom import Component

class TestLoggingComponent(Component):
    def some_method(self):
        # Test that both logger and configure work
        configure(log_level="INFO")
        logger.info("Test message from component")
        return "success"
    """)
    result = create_class(code, "TestLoggingComponent")
    assert result.__name__ == "TestLoggingComponent"
