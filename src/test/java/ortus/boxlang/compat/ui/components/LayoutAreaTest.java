/**
 * [BoxLang]
 *
 * Copyright [2023] [Ortus Solutions, Corp]
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
package ortus.boxlang.compat.ui.components;

import static com.google.common.truth.Truth.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import ortus.boxlang.compat.ui.BaseIntegrationTest;
import ortus.boxlang.runtime.scopes.Key;

public class LayoutAreaTest extends BaseIntegrationTest {

	@DisplayName( "It throws error when used outside Layout component" )
	@Test
	public void testMissingParentLayout() {
		try {
			runtime.executeSource(
			    """
			    bx:layoutarea title="Orphan Area" {
			        writeOutput("This should fail");
			    }
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "LayoutArea component must be used within a Layout component" );
		}
	}

	@DisplayName( "It validates border layout positions" )
	@Test
	public void testBorderLayoutPositionValidation() {
		try {
			runtime.executeSource(
			    """
			    bx:layout type="border" {
			        bx:layoutarea position="invalid" {
			            writeOutput("Invalid position");
			        }
			    }
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "position must be one of" );
		}
	}

	@DisplayName( "It handles border layout with all positions" )
	@Test
	public void testBorderLayoutAllPositions() {
		runtime.executeSource(
		    """
		    bx:layout type="border" {
		        bx:layoutarea position="top" size="50px" title="Header" {
		            writeOutput("Top content");
		        }
		        bx:layoutarea position="bottom" size="30px" {
		            writeOutput("Bottom content");
		        }
		        bx:layoutarea position="left" size="200px" minsize="100px" maxsize="300px" {
		            writeOutput("Left content");
		        }
		        bx:layoutarea position="right" size="150px" splitter="false" {
		            writeOutput("Right content");
		        }
		        bx:layoutarea position="center" {
		            writeOutput("Center content");
		        }
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-border-top" );
		assertThat( output ).contains( "bx-border-bottom" );
		assertThat( output ).contains( "bx-border-left" );
		assertThat( output ).contains( "bx-border-right" );
		assertThat( output ).contains( "bx-border-center" );
		assertThat( output ).contains( "Top content" );
		assertThat( output ).contains( "Bottom content" );
		assertThat( output ).contains( "Left content" );
		assertThat( output ).contains( "Right content" );
		assertThat( output ).contains( "Center content" );
	}

	@DisplayName( "It emits authoritative pixel dimensions for border area size" )
	@Test
	public void testBorderLayoutSizeEmitsPxDimensions() {
		runtime.executeSource(
		    """
		    bx:layout type="border" height="1000px" {
		        bx:layoutarea position="top" size="350" title="Search" {
		            writeOutput("Grid here");
		        }
		        bx:layoutarea position="left" size="200" {
		            writeOutput("Sidebar");
		        }
		        bx:layoutarea position="center" {
		            writeOutput("Center");
		        }
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		// Bare numeric sizes must be normalized to pixel units
		assertThat( output ).contains( "height: 350px" );
		assertThat( output ).contains( "width: 200px" );
	}

	@DisplayName( "It handles accordion layout areas with collapsible options" )
	@Test
	public void testAccordionLayoutAreas() {
		runtime.executeSource(
		    """
		    bx:layout type="accordion" {
		        bx:layoutarea title="First Panel" collapsible="true" {
		            writeOutput("First panel content");
		        }
		        bx:layoutarea title="Second Panel" initcollapsed="true" {
		            writeOutput("Second panel content");
		        }
		        bx:layoutarea title="Third Panel" collapsible="false" {
		            writeOutput("Third panel content");
		        }
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-accordion-panel" );
		assertThat( output ).contains( "bx-accordion-header" );
		assertThat( output ).contains( "bx-accordion-content" );
		assertThat( output ).contains( "First Panel" );
		assertThat( output ).contains( "Second Panel" );
		assertThat( output ).contains( "Third Panel" );
		assertThat( output ).contains( "collapsed" );
		assertThat( output ).contains( "First panel content" );
		assertThat( output ).contains( "Second panel content" );
		assertThat( output ).contains( "Third panel content" );
	}

	@DisplayName( "It handles tab layout areas" )
	@Test
	public void testTabLayoutAreas() {
		runtime.executeSource(
		    """
		    bx:layout type="tab" {
		        bx:layoutarea title="Home Tab" {
		            writeOutput("Home tab content");
		        }
		        bx:layoutarea title="About Tab" {
		            writeOutput("About tab content");
		        }
		        bx:layoutarea title="Contact Tab" {
		            writeOutput("Contact tab content");
		        }
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-tab-header" );
		assertThat( output ).contains( "bx-tab-panel" );
		assertThat( output ).contains( "Home Tab" );
		assertThat( output ).contains( "About Tab" );
		assertThat( output ).contains( "Contact Tab" );
		assertThat( output ).contains( "Home tab content" );
		assertThat( output ).contains( "About tab content" );
		assertThat( output ).contains( "Contact tab content" );
		assertThat( output ).contains( "active" ); // First tab should be active
	}

	@DisplayName( "It handles box layout areas" )
	@Test
	public void testBoxLayoutAreas() {
		runtime.executeSource(
		    """
		    bx:layout type="hbox" {
		        bx:layoutarea {
		            writeOutput("First box");
		        }
		        bx:layoutarea {
		            writeOutput("Second box");
		        }
		        bx:layoutarea {
		            writeOutput("Third box");
		        }
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-box-item" );
		assertThat( output ).contains( "First box" );
		assertThat( output ).contains( "Second box" );
		assertThat( output ).contains( "Third box" );
	}

	@DisplayName( "It auto-generates IDs for layout areas" )
	@Test
	public void testAutoGeneratedAreaIDs() {
		runtime.executeSource(
		    """
		    bx:layout type="tab" {
		        bx:layoutarea title="Test Tab" {
		            writeOutput("Test content");
		        }
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "layoutarea_" );
	}

	@DisplayName( "It handles custom IDs for layout areas" )
	@Test
	public void testCustomAreaIDs() {
		runtime.executeSource(
		    """
		    bx:layout type="tab" {
		        bx:layoutarea id="customTabArea" title="Custom Tab" {
		            writeOutput("Custom content");
		        }
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "customTabArea" );
		assertThat( output ).contains( "Custom Tab" );
		assertThat( output ).contains( "Custom content" );
	}

	@DisplayName( "It handles source attribute for external content" )
	@Test
	public void testSourceAttribute() {
		runtime.executeSource(
		    """
		    bx:layout type="tab" {
		        bx:layoutarea title="External Content" source="external.cfm" {
		            writeOutput("Fallback content");
		        }
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "External Content" );
		// Should contain comment about source loading
		assertThat( output ).contains( "Content loaded from: external.cfm" );
	}

	@DisplayName( "It handles alignment attributes" )
	@Test
	public void testAlignmentAttributes() {
		runtime.executeSource(
		    """
		    bx:layout type="hbox" {
		        bx:layoutarea align="left" {
		            writeOutput("Left aligned");
		        }
		        bx:layoutarea align="center" {
		            writeOutput("Center aligned");
		        }
		        bx:layoutarea align="right" {
		            writeOutput("Right aligned");
		        }
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "Left aligned" );
		assertThat( output ).contains( "Center aligned" );
		assertThat( output ).contains( "Right aligned" );
	}

	@DisplayName( "It handles complex nested content" )
	@Test
	public void testComplexNestedContent() {
		runtime.executeSource(
		    """
		    bx:layout type="tab" {
		        bx:layoutarea title="Complex Tab" {
		            writeOutput("<div class='nested-content'>");
		            writeOutput("<h2>Nested Heading</h2>");
		            writeOutput("<p>Paragraph with <strong>bold</strong> text.</p>");
		            writeOutput("<ul><li>List item 1</li><li>List item 2</li></ul>");
		            writeOutput("</div>");
		        }
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "Complex Tab" );
		assertThat( output ).contains( "nested-content" );
		assertThat( output ).contains( "Nested Heading" );
		assertThat( output ).contains( "<strong>bold</strong>" );
		assertThat( output ).contains( "<ul><li>List item 1</li>" );
	}

	@DisplayName( "It handles empty layout areas" )
	@Test
	public void testEmptyLayoutAreas() {
		runtime.executeSource(
		    """
		    bx:layout type="tab" {
		        bx:layoutarea title="Empty Tab" {
		            // No content
		        }
		        bx:layoutarea title="Another Empty Tab" {
		            writeOutput("");
		        }
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "Empty Tab" );
		assertThat( output ).contains( "Another Empty Tab" );
		// Should still render tab structure properly
		assertThat( output ).contains( "bx-tab-header" );
		assertThat( output ).contains( "bx-tab-panel" );
	}
}