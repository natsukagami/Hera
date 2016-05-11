import React from 'react';
import {Table, TableBody, TableHeader, TableHeaderColumn, TableRow, TableRowColumn} from 'material-ui/Table';
import IconAscending from 'material-ui/svg-icons/communication/call-made';
import IconDecending from 'material-ui/svg-icons/communication/call-received';

var OverviewTable = React.createClass({
	getInitialState() {
		return {
			// Raw data, for now
			students: [
				{
					name: 'Natsu Kagami',
					total: 40,
					problems: {
						GIFTS: 10,
						DOMINO: 10,
						COLOR: 10,
						PAREN: 10
					}
				}, {
					name: 'Pham Chi Bach',
					total: 30,
					problems: {
						COLOR: 1,
						PAREN: 10,
						GIFTS: 10,
						DOMINO: 9
					}
				}
			],
			problems: [
				'GIFTS', 'DOMINO', 'COLOR', 'PAREN'
			],
			currentOrder: {
				col: '__name',
				order: 1 // 1 = ascending, -1 = decending
			}
		};
	},
	handleHeaderClick(event) {
		if (event.target.getAttribute('data-colName') === undefined) return;
		if (event.target.getAttribute('data-colName') == this.state.currentOrder.col) {
			this.state.currentOrder.order *= -1;
		} else this.state.currentOrder = {
			col: event.target.getAttribute('data-colName'),
			order: 1
		};
		var instance = this;
		this.state.students.sort(function(a, b) {
			var x, y;
			if (instance.state.currentOrder.col === '__name') {
				x = a.name, y = b.name;
			} else if (instance.state.currentOrder.col === '__total') {
				x = a.total, y = b.total;
			} else {
				x = a.problems[instance.state.currentOrder.col], y = b.problems[instance.state.currentOrder.col];
			}
			var ans = (x < y ? -1 : (x === y ? 0 : 1)) * instance.state.currentOrder.order;
			console.log(a, b, x, y, instance.state.currentOrder.col, ans); return ans;
		});
		console.log(JSON.stringify(this.state));
		this.forceUpdate();
	},
	renderHeader(name, colname) {
		var added = '';
		if (colname === this.state.currentOrder.col) {
			added = <span>
				{(this.state.currentOrder.order == 1 ? <IconAscending style={{width: 14, height: 14}}/> :
					<IconDecending style={{width: 14, height: 14}}/>)}
			</span>;
		}
		return (<span>
					<span data-colName={colname} onClick={this.handleHeaderClick}>{name}</span>
					{added}
				</span>);
	},
	render() {
		var instance = this;
		var problemHeaders = this.state.problems.map(function(problem) {
			return (<TableHeaderColumn>
				{instance.renderHeader(problem, problem)}
			</TableHeaderColumn>);
		});
		var studentRows = this.state.students.map(function(student) {
			var problems = instance.state.problems.map(function(problem) {
				return (<TableRowColumn>{student.problems[problem]}</TableRowColumn>);
			});
			return (
			<TableRow>
				<TableRowColumn>{student.name}</TableRowColumn>
				{problems}
				<TableRowColumn>{student.total}</TableRowColumn>
			</TableRow>
			);
		});
		return (
		<Table
			className='dynamicTable'
			height={Math.round(window.innerHeight * 0.6).toString() + 'px'}
			multiSelectable={true}
		>
			<TableHeader
				displaySelectAll={true}
			>
				<TableRow>
					<TableHeaderColumn>
						{this.renderHeader('Tên học sinh', '__name')}
					</TableHeaderColumn>
					{problemHeaders}
					<TableHeaderColumn>
						{this.renderHeader('Tổng Điểm', '__total')}
					</TableHeaderColumn>
				</TableRow>
			</TableHeader>
			<TableBody>
				{studentRows}
			</TableBody>
		</Table>
		);
	}
});

export default OverviewTable;
