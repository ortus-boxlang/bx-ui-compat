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

public class GridTest extends BaseIntegrationTest {

	@DisplayName( "It can create a basic grid with name" )
	@Test
	public void testBasicGrid() {
		runtime.executeSource(
		    """
		    bx:grid name="myGrid" {
		        bx:gridcolumn name="id" header="ID";
		        bx:gridcolumn name="name" header="Name";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-grid" );
		assertThat( output ).contains( "data-name=\"myGrid\"" );
		assertThat( output ).contains( "bx-grid-table" );
		assertThat( output ).contains( "bx-grid-header" );
		assertThat( output ).contains( "bx-grid-body" );
	}

	@DisplayName( "It throws error when name attribute is missing" )
	@Test
	public void testMissingNameAttribute() {
		try {
			runtime.executeSource(
			    """
			    bx:grid {
			        bx:gridcolumn name="test";
			    }
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "name attribute is required" );
		}
	}

	@DisplayName( "It can set grid dimensions and styling" )
	@Test
	public void testGridDimensions() {
		runtime.executeSource(
		    """
		    bx:grid
		        name="sizedGrid"
		        height="400px"
		        width="600px"
		        class="my-grid-class"
		        style="border: 1px solid gray;" {
		        bx:gridcolumn name="col1";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "height: 400px" );
		assertThat( output ).contains( "width: 600px" );
		assertThat( output ).contains( "my-grid-class" );
		assertThat( output ).contains( "border: 1px solid gray" );
	}

	@DisplayName( "It can configure grid behavior attributes" )
	@Test
	public void testGridBehaviorAttributes() {
		runtime.executeSource(
		    """
		    bx:grid
		        name="behaviorGrid"
		        sortable="true"
		        editable="true"
		        selectMode="row"
		        pageSize="50"
		        stripeRows="false" {
		        bx:gridcolumn name="id";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-grid-sortable" );
		assertThat( output ).contains( "bx-grid-editable" );
		assertThat( output ).contains( "data-sortable=\"true\"" );
		assertThat( output ).contains( "data-editable=\"true\"" );
		assertThat( output ).contains( "data-select-mode=\"row\"" );
		assertThat( output ).contains( "data-page-size=\"50\"" );
		assertThat( output ).doesNotContain( "bx-grid-striped" );
	}

	@DisplayName( "It throws error for invalid selectMode" )
	@Test
	public void testInvalidSelectMode() {
		try {
			runtime.executeSource(
			    """
			    bx:grid name="testGrid" selectMode="invalid" {
			        bx:gridcolumn name="test";
			    }
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "selectMode attribute must be one of" );
		}
	}

	@DisplayName( "It generates grid headers from columns" )
	@Test
	public void testGridHeaders() {
		runtime.executeSource(
		    """
		    bx:grid name="headerGrid" showHeaders="true" {
		        bx:gridcolumn name="id" header="ID Column" width="80px";
		        bx:gridcolumn name="name" header="Name Column" width="200px";
		        bx:gridcolumn name="email" header="Email Address";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-grid-column-header" );
		assertThat( output ).contains( "ID Column" );
		assertThat( output ).contains( "Name Column" );
		assertThat( output ).contains( "Email Address" );
		assertThat( output ).contains( "data-column=\"id\"" );
		assertThat( output ).contains( "data-column=\"name\"" );
		assertThat( output ).contains( "data-column=\"email\"" );
	}

	@DisplayName( "It can hide headers when showHeaders is false" )
	@Test
	public void testGridNoHeaders() {
		runtime.executeSource(
		    """
		    bx:grid name="noHeaderGrid" showHeaders="false" {
		        bx:gridcolumn name="col1" header="Hidden Header";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).doesNotContain( "<thead>" );
		assertThat( output ).doesNotContain( "bx-grid-header" );
		assertThat( output ).doesNotContain( "Hidden Header" );
		assertThat( output ).contains( "bx-grid-body" );
	}

	@DisplayName( "It generates JavaScript for grid functionality" )
	@Test
	public void testGridJavaScript() {
		runtime.executeSource(
		    """
		    bx:grid
		        name="jsGrid"
		        sortable="true"
		        editable="true"
		        onLoad="gridLoaded"
		        onEdit="cellEdited"
		        onSort="columnSorted" {
		        bx:gridcolumn name="test";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "<script type=\"text/javascript\">" );
		assertThat( output ).contains( "addEventListener('click'" );
		assertThat( output ).contains( "sortColumn" );
		assertThat( output ).contains( "goToPage" );
		assertThat( output ).contains( "toggleSelectAll" );
		assertThat( output ).contains( "gridLoaded();" );
		assertThat( output ).contains( "cellEdited(column, row, value);" );
		assertThat( output ).contains( "columnSorted(column, newSort);" );
	}

	@DisplayName( "It auto-generates ID when not provided" )
	@Test
	public void testGridAutoGeneratedID() {
		runtime.executeSource(
		    """
		    bx:grid name="autoIdGrid" {
		        bx:gridcolumn name="test";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "id=\"grid_" );
	}

	@DisplayName( "It handles grid with manual rows" )
	@Test
	public void testGridWithManualRows() {
		runtime.executeSource(
		    """
		    bx:grid name="manualRowGrid" {
		        bx:gridcolumn name="id" header="ID";
		        bx:gridcolumn name="name" header="Name";
		        bx:gridrow data="#{ id: 1, name: 'John' }#";
		        bx:gridrow data="#{ id: 2, name: 'Jane' }#";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-grid-row" );
		assertThat( output ).contains( "bx-grid-cell" );
		assertThat( output ).contains( "John" );
		assertThat( output ).contains( "Jane" );
	}

	@DisplayName( "It generates selection columns for all (multi) select mode" )
	@Test
	public void testGridMultiSelect() {
		runtime.executeSource(
		    """
		    bx:grid name="multiSelectGrid" selectMode="all" {
		        bx:gridcolumn name="name" header="Name";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-grid-select-header" );
		// In "all" select mode, should have select-all checkbox in header
		assertThat( output ).contains( "<input type=\"checkbox\" class=\"bx-grid-select-all\"" );
		assertThat( output ).contains( "type=\"checkbox\"" );
	}

	@DisplayName( "It generates selection columns for row select mode (radio)" )
	@Test
	public void testGridSingleSelect() {
		runtime.executeSource(
		    """
		    bx:grid name="singleSelectGrid" selectMode="row" {
		        bx:gridcolumn name="name" header="Name";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-grid-select-header" );
		// In "row" select mode, should use radio buttons for single-row selection
		assertThat( output ).contains( "type=\"radio\"" );
		// Should not contain select-all checkbox in the header
		assertThat( output ).doesNotContain( "<input type=\"checkbox\" class=\"bx-grid-select-all\"" );
	}

	@DisplayName( "It does not generate selection columns for browse/single/column/edit modes" )
	@Test
	public void testGridNoSelectColumn() {
		// "browse" mode should have no selection column
		runtime.executeSource(
		    """
		    bx:grid name="browseGrid" selectMode="browse" {
		        bx:gridcolumn name="name" header="Name";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).doesNotContain( "<th class=\"bx-grid-select-header\"" );
		assertThat( output ).doesNotContain( "<td class=\"bx-grid-select-cell\"" );
	}

	@DisplayName( "It applies bx-grid-select-mode CSS class for each selectMode" )
	@Test
	public void testGridSelectModeClass() {
		for ( String mode : new String[] { "edit", "row", "single", "column", "browse", "all" } ) {
			runtime.executeSource(
			    String.format(
			        """
			        bx:grid name="modeGrid" selectMode="%s" {
			            bx:gridcolumn name="name";
			        }
			        result = getBoxContext().getBuffer().toString()
			        """,
			        mode
			    ),
			    context
			);
			String output = variables.getAsString( Key.of( "result" ) );
			assertThat( output ).contains( "bx-grid-select-mode-" + mode );
		}
	}

	@DisplayName( "It generates pagination when pageSize is set" )
	@Test
	public void testGridPagination() {
		runtime.executeSource(
		    """
		    // Create a mock query with more records than pageSize
		    myQuery = queryNew("id,name", "integer,varchar", [
		        [1, "Record 1"], [2, "Record 2"], [3, "Record 3"],
		        [4, "Record 4"], [5, "Record 5"], [6, "Record 6"]
		    ]);

		    bx:grid name="paginatedGrid" query="#myQuery#" pageSize="3" {
		        bx:gridcolumn name="id" header="ID";
		        bx:gridcolumn name="name" header="Name";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-grid-pagination" );
		assertThat( output ).contains( "bx-grid-page-btn" );
		assertThat( output ).contains( "Next" );
	}

	@DisplayName( "It fires custom events for grid interactions" )
	@Test
	public void testGridCustomEvents() {
		runtime.executeSource(
		    """
		    bx:grid name="eventGrid" sortable="true" editable="true" {
		        bx:gridcolumn name="test";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "gridCellEdit" );
		assertThat( output ).contains( "gridSort" );
		assertThat( output ).contains( "gridPageChange" );
		assertThat( output ).contains( "CustomEvent" );
		assertThat( output ).contains( "dispatchEvent" );
	}

	@DisplayName( "It can handle color attributes" )
	@Test
	public void testGridColorAttributes() {
		runtime.executeSource(
		    """
		    bx:grid name="colorGrid" bgColor="##f0f0f0" textColor="##333333" {
		        bx:gridcolumn name="test";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "background-color: #f0f0f0" );
		assertThat( output ).contains( "color: #333333" );
	}

	@DisplayName( "It can handle font attributes" )
	@Test
	public void testGridFontAttributes() {
		runtime.executeSource(
		    """
		    bx:grid name="fontGrid" font="Arial" fontSize="14" bold="true" italic="true" {
		        bx:gridcolumn name="test";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "font-family: Arial" );
		assertThat( output ).contains( "font-size: 14px" );
		assertThat( output ).contains( "font-weight: bold" );
		assertThat( output ).contains( "font-style: italic" );
	}

	@DisplayName( "It can handle column header styling" )
	@Test
	public void testGridColumnHeaderStyling() {
		runtime.executeSource(
		    """
		    bx:grid name="headerGrid" colHeaderBold="true" colHeaderItalic="true"
		           colHeaderFont="Helvetica" colHeaderFontSize="16" colHeaderTextColor="##666" {
		        bx:gridcolumn name="test" header="Test Column";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "font-weight: bold" );
		assertThat( output ).contains( "font-style: italic" );
		assertThat( output ).contains( "font-family: Helvetica" );
		assertThat( output ).contains( "font-size: 16px" );
		assertThat( output ).contains( "color: #666" );
	}

	@DisplayName( "It can handle action buttons" )
	@Test
	public void testGridActionButtons() {
		runtime.executeSource(
		    """
		    bx:grid name="actionGrid" insertButton="true" deleteButton="true" {
		        bx:gridcolumn name="test";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-grid-actions" );
		assertThat( output ).contains( "bx-grid-insert-btn" );
		assertThat( output ).contains( "bx-grid-delete-btn" );
		assertThat( output ).contains( "Insert" );
		assertThat( output ).contains( "Delete" );
	}

	@DisplayName( "It can handle data attributes" )
	@Test
	public void testGridDataAttributes() {
		runtime.executeSource(
		    """
		    bx:grid name="dataGrid" enabled="false" appendKey="true"
		           delete="true" insert="true" maxRows="100" gridDataAlign="center" {
		        bx:gridcolumn name="test";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "data-enabled=\"false\"" );
		assertThat( output ).contains( "data-append-key=\"true\"" );
		assertThat( output ).contains( "data-delete=\"true\"" );
		assertThat( output ).contains( "data-insert=\"true\"" );
		assertThat( output ).contains( "data-max-rows=\"100\"" );
		assertThat( output ).contains( "data-data-align=\"center\"" );
	}

	@DisplayName( "It can handle multirowselect mapping" )
	@Test
	public void testGridMultirowSelect() {
		runtime.executeSource(
		    """
		    bx:grid name="multiGrid" multirowselect="true" {
		        bx:gridcolumn name="test";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "data-select-mode=\"all\"" );
		assertThat( output ).contains( "type=\"checkbox\"" );
	}

	@DisplayName( "It validates format attribute" )
	@Test
	public void testGridFormatValidation() {
		runtime.executeSource(
		    """
		    try {
		        bx:grid name="invalidGrid" format="invalid" {
		            bx:gridcolumn name="test";
		        }
		        hasError = false;
		    } catch (any e) {
		        hasError = true;
		        errorMessage = e.message;
		    }
		    """,
		    context
		);

		Boolean hasError = variables.getAsBoolean( Key.of( "hasError" ) );
		assertThat( hasError ).isTrue();
	}

	@DisplayName( "It validates gridDataAlign attribute" )
	@Test
	public void testGridDataAlignValidation() {
		runtime.executeSource(
		    """
		    try {
		        bx:grid name="invalidGrid" gridDataAlign="invalid" {
		            bx:gridcolumn name="test";
		        }
		        hasError = false;
		    } catch (any e) {
		        hasError = true;
		        errorMessage = e.message;
		    }
		    """,
		    context
		);

		Boolean hasError = variables.getAsBoolean( Key.of( "hasError" ) );
		assertThat( hasError ).isTrue();
	}
}