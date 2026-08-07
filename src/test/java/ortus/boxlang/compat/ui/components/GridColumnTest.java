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

public class GridColumnTest extends BaseIntegrationTest {

	@DisplayName( "It can create grid columns within grid" )
	@Test
	public void testBasicGridColumn() {
		runtime.executeSource(
		    """
		    bx:grid name="columnTest" {
		        bx:gridcolumn name="id" header="ID Column" width="80px" sortable="true";
		        bx:gridcolumn name="name" header="Name Column" width="200px" editable="true";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "ID Column" );
		assertThat( output ).contains( "Name Column" );
		assertThat( output ).contains( "data-column=\"id\"" );
		assertThat( output ).contains( "data-column=\"name\"" );
		assertThat( output ).contains( "width: 80px" );
		assertThat( output ).contains( "width: 200px" );
	}

	@DisplayName( "It throws error when used outside Grid component" )
	@Test
	public void testGridColumnOutsideGrid() {
		try {
			runtime.executeSource(
			    """
			    bx:gridcolumn name="orphan" header="Orphaned Column";
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "GridColumn component must be used within a Grid component" );
		}
	}

	@DisplayName( "It throws error when name attribute is missing" )
	@Test
	public void testGridColumnMissingName() {
		try {
			runtime.executeSource(
			    """
			    bx:grid name="testGrid" {
			        bx:gridcolumn header="No Name Column";
			    }
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "name attribute is required" );
		}
	}

	@DisplayName( "It uses name as header when header not provided" )
	@Test
	public void testGridColumnDefaultHeader() {
		runtime.executeSource(
		    """
		    bx:grid name="defaultHeaderGrid" {
		        bx:gridcolumn name="username";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "username" );
		assertThat( output ).contains( "data-column=\"username\"" );
	}

	@DisplayName( "It can set column alignment" )
	@Test
	public void testGridColumnAlignment() {
		runtime.executeSource(
		    """
		    bx:grid name="alignmentGrid" {
		        bx:gridcolumn name="left" dataAlign="left" headerAlign="left";
		        bx:gridcolumn name="center" dataAlign="center" headerAlign="center";
		        bx:gridcolumn name="right" dataAlign="right" headerAlign="right";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "data-column=\"left\"" );
		assertThat( output ).contains( "data-column=\"center\"" );
		assertThat( output ).contains( "data-column=\"right\"" );
	}

	@DisplayName( "It throws error for invalid alignment values" )
	@Test
	public void testGridColumnInvalidAlignment() {
		try {
			runtime.executeSource(
			    """
			    bx:grid name="testGrid" {
			        bx:gridcolumn name="test" dataAlign="invalid";
			    }
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "dataAlign attribute must be one of" );
		}
	}

	@DisplayName( "It can set column data types" )
	@Test
	public void testGridColumnDataTypes() {
		runtime.executeSource(
		    """
		    bx:grid name="typeGrid" {
		        bx:gridcolumn name="id" type="numeric";
		        bx:gridcolumn name="name" type="string";
		        bx:gridcolumn name="birthdate" type="date";
		        bx:gridcolumn name="active" type="boolean";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "data-column=\"id\"" );
		assertThat( output ).contains( "data-column=\"name\"" );
		assertThat( output ).contains( "data-column=\"birthdate\"" );
		assertThat( output ).contains( "data-column=\"active\"" );
	}

	@DisplayName( "It throws error for invalid data type" )
	@Test
	public void testGridColumnInvalidType() {
		try {
			runtime.executeSource(
			    """
			    bx:grid name="testGrid" {
			        bx:gridcolumn name="test" type="invalidtype";
			    }
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "type attribute must be one of" );
		}
	}

	@DisplayName( "It can configure column editing with values" )
	@Test
	public void testGridColumnWithValues() {
		runtime.executeSource(
		    """
		    bx:grid name="valuesGrid" {
		        bx:gridcolumn
		            name="status"
		            header="Status"
		            editable="true"
		            values="active,inactive,pending"
		            valuesDisplay="Active,Inactive,Pending";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "Status" );
		assertThat( output ).contains( "data-column=\"status\"" );
	}

	@DisplayName( "It can create link columns with href" )
	@Test
	public void testGridColumnWithHref() {
		runtime.executeSource(
		    """
		    bx:grid name="linkGrid" {
		        bx:gridcolumn
		            name="name"
		            header="Name"
		            href="/user/details?id={id}"
		            target="_blank";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "Name" );
		assertThat( output ).contains( "data-column=\"name\"" );
	}

	@DisplayName( "It can set column formatting options" )
	@Test
	public void testGridColumnFormatting() {
		runtime.executeSource(
		    """
		    bx:grid name="formatGrid" {
		        bx:gridcolumn
		            name="salary"
		            type="numeric"
		            numberFormat="$___,___.00";
		        bx:gridcolumn
		            name="hireDate"
		            type="date"
		            dateFormat="mm/dd/yyyy";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "data-column=\"salary\"" );
		assertThat( output ).contains( "data-column=\"hireDate\"" );
	}

	@DisplayName( "It can control column visibility" )
	@Test
	public void testGridColumnVisibility() {
		runtime.executeSource(
		    """
		    bx:grid name="visibilityGrid" {
		        bx:gridcolumn name="visible" type="html" display="true";
		        bx:gridcolumn name="hidden" display="false";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "data-column=\"visible\"" );
		// Hidden column might still appear in structure but not be displayed
		assertThat( output ).doesNotContain( "data-column=\"hidden\"" );
	}

	@DisplayName( "It can configure sortable columns" )
	@Test
	public void testGridColumnSortable() {
		runtime.executeSource(
		    """
		    bx:grid name="sortableGrid" sortable="true" {
		        bx:gridcolumn name="sortable" sortable="true";
		        bx:gridcolumn name="nonsortable" sortable="false";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "data-column=\"sortable\"" );
		assertThat( output ).contains( "data-column=\"nonsortable\"" );
		assertThat( output ).contains( "bx-grid-sort-indicator" );
	}

	@DisplayName( "It can configure editable columns" )
	@Test
	public void testGridColumnEditable() {
		runtime.executeSource(
		    """
		    bx:grid name="editableGrid" editable="true" {
		        bx:gridcolumn name="readonly" editable="false";
		        bx:gridcolumn name="editable" editable="true";
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "data-column=\"readonly\"" );
		assertThat( output ).contains( "data-column=\"editable\"" );
	}
}